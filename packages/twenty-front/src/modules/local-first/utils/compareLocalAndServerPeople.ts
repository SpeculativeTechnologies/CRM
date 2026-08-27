import { type RequestedNodeField } from '@/local-first/utils/extractRequestedNodeFields';
import { normalizeComparableValue } from '@/local-first/utils/normalizeComparableValue';

export type LocalFirstComparisonResult = {
  isMatch: boolean;
  serverCount: number;
  localCount: number;
  comparedFieldCount: number;
  // Human-readable divergences, capped so one bad query can't flood the log.
  differences: string[];
};

const MAX_REPORTED_DIFFERENCES = 5;

type Comparison = {
  differences: string[];
  comparedFieldCount: number;
};

const readEdgeNodes = (value: unknown): Record<string, unknown>[] => {
  const edges = (value as { edges?: { node?: unknown }[] })?.edges;

  if (!Array.isArray(edges)) return [];

  return edges
    .map((edge) => edge?.node)
    .filter((node): node is Record<string, unknown> => !!node);
};

const toNestedFields = (field: RequestedNodeField): RequestedNodeField[] =>
  field.relation?.nodeFields ??
  field.subFields.map((name) => ({ name, subFields: [], relation: null }));

const compareRecords = ({
  serverRecord,
  localRecord,
  requestedFields,
  path,
  comparison,
}: {
  serverRecord: Record<string, unknown>;
  localRecord: Record<string, unknown>;
  requestedFields: RequestedNodeField[];
  path: string;
  comparison: Comparison;
}): void => {
  const addDifference = (difference: string) => {
    if (comparison.differences.length < MAX_REPORTED_DIFFERENCES) {
      comparison.differences.push(difference);
    }
  };

  const compareValues = (
    fieldPath: string,
    serverValue: unknown,
    localValue: unknown,
  ) => {
    comparison.comparedFieldCount += 1;

    const normalizedServerValue = normalizeComparableValue(serverValue);
    const normalizedLocalValue = normalizeComparableValue(localValue);

    if (normalizedServerValue !== normalizedLocalValue) {
      addDifference(
        `${fieldPath}: server "${normalizedServerValue}", local "${normalizedLocalValue}"`,
      );
    }
  };

  for (const field of requestedFields) {
    const fieldPath = path ? `${path}.${field.name}` : field.name;

    // A field the query did not actually select is absent from the response;
    // absence must not count as a divergence.
    if (!(field.name in serverRecord)) continue;

    const serverValue = serverRecord[field.name];
    const localValue = localRecord[field.name];

    if (field.relation?.kind === 'toMany') {
      const serverNodes = readEdgeNodes(serverValue);
      const localNodes = readEdgeNodes(localValue);

      if (serverNodes.length !== localNodes.length) {
        addDifference(
          `${fieldPath}: server ${serverNodes.length} related, local ${localNodes.length}`,
        );
        continue;
      }

      serverNodes.forEach((serverNode, index) => {
        compareRecords({
          serverRecord: serverNode,
          localRecord: localNodes[index],
          requestedFields: toNestedFields(field),
          path: `${fieldPath}[${index}]`,
          comparison,
        });
      });

      continue;
    }

    const isObjectPair =
      typeof serverValue === 'object' &&
      serverValue !== null &&
      typeof localValue === 'object' &&
      localValue !== null;

    const isNestedSelection =
      field.relation?.kind === 'toOne' || field.subFields.length > 0;

    if (isNestedSelection) {
      // A null relation or an all-null composite is null on both sides, so
      // compare them as values rather than descending into nothing.
      if (!isObjectPair) {
        compareValues(fieldPath, serverValue, localValue);
        continue;
      }

      compareRecords({
        serverRecord: serverValue as Record<string, unknown>,
        localRecord: localValue as Record<string, unknown>,
        requestedFields: toNestedFields(field),
        path: fieldPath,
        comparison,
      });

      continue;
    }

    compareValues(fieldPath, serverValue, localValue);
  }
};

// Compares the records the server returned for a people list query against the
// records the local mirror produced for the same query. Both sides are in the
// API's shape by this point, so the comparison walks the requested selection,
// relations included. Order matters: the right rows in the wrong order still
// breaks a paginated table.
export const compareLocalAndServerPeople = ({
  serverRecords,
  localRecords,
  requestedFields,
}: {
  serverRecords: Record<string, unknown>[];
  localRecords: Record<string, unknown>[];
  requestedFields: RequestedNodeField[];
}): LocalFirstComparisonResult => {
  const comparison: Comparison = { differences: [], comparedFieldCount: 0 };

  if (serverRecords.length !== localRecords.length) {
    comparison.differences.push(
      `row count: server ${serverRecords.length}, local ${localRecords.length}`,
    );
  }

  const comparedLength = Math.min(serverRecords.length, localRecords.length);

  for (let index = 0; index < comparedLength; index++) {
    const serverRecord = serverRecords[index];
    const localRecord = localRecords[index];

    if (serverRecord.id !== localRecord.id) {
      if (comparison.differences.length < MAX_REPORTED_DIFFERENCES) {
        comparison.differences.push(
          `position ${index}: server id ${String(serverRecord.id)}, local id ${String(localRecord.id)}`,
        );
      }

      continue;
    }

    compareRecords({
      serverRecord,
      localRecord,
      requestedFields,
      path: '',
      comparison,
    });
  }

  return {
    isMatch: comparison.differences.length === 0,
    serverCount: serverRecords.length,
    localCount: localRecords.length,
    comparedFieldCount: comparison.comparedFieldCount,
    differences: comparison.differences,
  };
};
