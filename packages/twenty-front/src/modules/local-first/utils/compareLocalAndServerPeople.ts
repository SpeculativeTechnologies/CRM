import { type RequestedNodeField } from '@/local-first/utils/extractRequestedNodeFields';
import { normalizeComparableValue } from '@/local-first/utils/normalizeComparableValue';
import {
  type LocalFieldSource,
  readLocalFieldValue,
  resolveLocalFieldSource,
} from '@/local-first/utils/resolveLocalFieldSource';

export type LocalFirstComparisonResult = {
  isMatch: boolean;
  serverCount: number;
  localCount: number;
  comparedFieldCount: number;
  // Human-readable divergences, capped so one bad query can't flood the log.
  differences: string[];
};

const MAX_REPORTED_DIFFERENCES = 5;

const NOT_REQUESTED = Symbol('notRequested');

// Distinguishes "the query did not select this field" from "the value is
// null": a field a view does not display is absent from the response, and
// absence must not count as a divergence.
const readServerValue = (
  record: Record<string, unknown>,
  path: readonly string[],
): unknown | typeof NOT_REQUESTED => {
  let current: unknown = record;

  for (const key of path) {
    if (typeof current !== 'object' || current === null) return NOT_REQUESTED;
    if (!(key in current)) return NOT_REQUESTED;

    current = (current as Record<string, unknown>)[key];
  }

  return current;
};

// Every (server path, local source) pair a query asked for. Relations are
// skipped: they live in other tables, and the coverage check refuses queries
// that request them before a local read is attempted.
const toComparablePairs = (
  requestedFields: RequestedNodeField[],
  syncedColumns: ReadonlySet<string>,
) => {
  const pairs: { path: string[]; source: LocalFieldSource; label: string }[] =
    [];

  for (const field of requestedFields) {
    if (field.hasNestedSelections) continue;

    if (field.subFields.length === 0) {
      const source = resolveLocalFieldSource({
        fieldName: field.name,
        syncedColumns,
      });

      if (source) {
        pairs.push({ path: [field.name], source, label: field.name });
      }

      continue;
    }

    for (const subField of field.subFields) {
      const source = resolveLocalFieldSource({
        fieldName: field.name,
        subFieldName: subField,
        syncedColumns,
      });

      if (source) {
        pairs.push({
          path: [field.name, subField],
          source,
          label: `${field.name}.${subField}`,
        });
      }
    }
  }

  return pairs;
};

// Compares what the server returned for a FindManyPeople query against what
// the local database returned for the translated query. Order matters: a local
// read that returns the right set in the wrong order is still wrong for a
// paginated table.
export const compareLocalAndServerPeople = ({
  serverRecords,
  localRecords,
  requestedFields,
  syncedColumns,
}: {
  serverRecords: Record<string, unknown>[];
  localRecords: Record<string, unknown>[];
  requestedFields: RequestedNodeField[];
  syncedColumns: readonly string[];
}): LocalFirstComparisonResult => {
  const differences: string[] = [];
  let comparedFieldCount = 0;

  const addDifference = (difference: string) => {
    if (differences.length < MAX_REPORTED_DIFFERENCES) {
      differences.push(difference);
    }
  };

  if (serverRecords.length !== localRecords.length) {
    addDifference(
      `row count: server ${serverRecords.length}, local ${localRecords.length}`,
    );
  }

  const comparablePairs = toComparablePairs(
    requestedFields,
    new Set(syncedColumns),
  );
  const comparedLength = Math.min(serverRecords.length, localRecords.length);

  for (let index = 0; index < comparedLength; index++) {
    const serverRecord = serverRecords[index];
    const localRecord = localRecords[index];

    if (serverRecord.id !== localRecord.id) {
      addDifference(
        `position ${index}: server id ${String(serverRecord.id)}, local id ${String(localRecord.id)}`,
      );
      continue;
    }

    for (const pair of comparablePairs) {
      const serverValue = readServerValue(serverRecord, pair.path);

      if (serverValue === NOT_REQUESTED) continue;

      comparedFieldCount += 1;

      const normalizedServerValue = normalizeComparableValue(serverValue);
      const normalizedLocalValue = normalizeComparableValue(
        readLocalFieldValue({ record: localRecord, source: pair.source }),
      );

      if (normalizedServerValue !== normalizedLocalValue) {
        addDifference(
          `${String(serverRecord.id)}.${pair.label}: server "${normalizedServerValue}", local "${normalizedLocalValue}"`,
        );
      }
    }
  }

  return {
    isMatch: differences.length === 0,
    serverCount: serverRecords.length,
    localCount: localRecords.length,
    comparedFieldCount,
    differences,
  };
};
