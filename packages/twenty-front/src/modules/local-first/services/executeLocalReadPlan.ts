import { type PGlite } from '@electric-sql/pglite';
import { isDefined } from 'twenty-shared/utils';

import { LOCAL_FIRST_LIST_VALUED_SUBFIELDS } from '@/local-first/constants/LOCAL_FIRST_LIST_VALUED_SUBFIELDS';
import { type LocalReadPlan } from '@/local-first/utils/buildLocalReadPlan';
import { readLocalFieldValue } from '@/local-first/utils/resolveLocalFieldSource';
import { toApiValue } from '@/local-first/utils/toApiValue';

type LocalRow = Record<string, unknown>;

const buildNode = (row: LocalRow, plan: LocalReadPlan): LocalRow => {
  const node: LocalRow = { __typename: plan.typeName };

  for (const field of plan.scalarFields) {
    node[field.name] = toApiValue(
      readLocalFieldValue({ record: row, source: field.source }),
    );
  }

  for (const composite of plan.compositeFields) {
    const value: LocalRow = {};
    let hasAnyValue = false;

    for (const subField of composite.subFields) {
      const subValue = toApiValue(
        readLocalFieldValue({ record: row, source: subField.source }),
      );

      const isListValued = LOCAL_FIRST_LIST_VALUED_SUBFIELDS.includes(
        subField.name,
      );

      value[subField.name] = subValue ?? (isListValued ? [] : null);
      if (isDefined(subValue)) hasAnyValue = true;
    }

    // A composite whose every part is null is null on the API too, so an
    // object of nulls would not match what the server returns.
    node[composite.name] = hasAnyValue ? value : null;
  }

  return node;
};

const selectRowsByIds = async ({
  pg,
  plan,
  column,
  ids,
}: {
  pg: PGlite;
  plan: LocalReadPlan;
  column: string;
  ids: string[];
}): Promise<LocalRow[]> => {
  if (ids.length === 0) return [];

  // The filter column has to be selected too: to-many results are grouped by
  // their back-reference, and a column that is not selected reads as
  // undefined, which silently produced empty relations.
  const selectedColumns = [...new Set([...plan.columns, column])]
    .map((name) => `"${name}"`)
    .join(', ');

  // Explicit placeholders rather than = any($1::uuid[]): array binding did
  // not match any rows here, and an IN list is unambiguous.
  const placeholders = ids.map((_id, index) => `$${index + 1}`).join(', ');

  const result = await pg.query<LocalRow>(
    `select ${selectedColumns} from "${plan.table}"
     where "${column}" in (${placeholders})`,
    ids,
  );

  return result.rows;
};

// Resolves a plan's relations for a set of already-selected rows, attaching
// them to the nodes. Relations are fetched one query per relation for the
// whole page rather than per row, which is what keeps a page of records to a
// handful of local queries instead of hundreds.
const attachRelations = async ({
  pg,
  plan,
  rows,
  nodes,
}: {
  pg: PGlite;
  plan: LocalReadPlan;
  rows: LocalRow[];
  nodes: LocalRow[];
}): Promise<void> => {
  for (const relation of plan.relations) {
    const source = relation.source;

    if (source.kind === 'toOne') {
      const foreignKeys = rows
        .map((row) => row[source.foreignKeyColumn])
        .filter((value): value is string => typeof value === 'string');

      const targetRows = await selectRowsByIds({
        pg,
        plan: relation.plan,
        column: 'id',
        ids: [...new Set(foreignKeys)],
      });

      const targetNodesById = new Map<string, LocalRow>();

      const targetNodes = targetRows.map((targetRow) =>
        buildNode(targetRow, relation.plan),
      );

      await attachRelations({
        pg,
        plan: relation.plan,
        rows: targetRows,
        nodes: targetNodes,
      });

      targetRows.forEach((targetRow, index) => {
        targetNodesById.set(String(targetRow.id), targetNodes[index]);
      });

      rows.forEach((row, index) => {
        const foreignKey = row[source.foreignKeyColumn];

        nodes[index][relation.name] =
          typeof foreignKey === 'string'
            ? (targetNodesById.get(foreignKey) ?? null)
            : null;
      });

      continue;
    }

    const ownerIds = rows
      .map((row) => row.id)
      .filter((value): value is string => typeof value === 'string');

    const targetRows = await selectRowsByIds({
      pg,
      plan: relation.plan,
      column: source.targetForeignKeyColumn,
      ids: ownerIds,
    });

    const targetNodes = targetRows.map((targetRow) =>
      buildNode(targetRow, relation.plan),
    );

    await attachRelations({
      pg,
      plan: relation.plan,
      rows: targetRows,
      nodes: targetNodes,
    });

    const nodesByOwnerId = new Map<string, LocalRow[]>();

    targetRows.forEach((targetRow, index) => {
      const ownerId = String(targetRow[source.targetForeignKeyColumn]);
      const existing = nodesByOwnerId.get(ownerId) ?? [];

      existing.push(targetNodes[index]);
      nodesByOwnerId.set(ownerId, existing);
    });

    rows.forEach((row, index) => {
      const related = nodesByOwnerId.get(String(row.id)) ?? [];

      nodes[index][relation.name] = {
        __typename: `${relation.plan.typeName}Connection`,
        edges: related.map((relatedNode) => ({
          __typename: `${relation.plan.typeName}Edge`,
          node: relatedNode,
          cursor: '',
        })),
      };
    });
  }
};

// Runs a plan's root query and assembles GraphQL-shaped records, relations
// included, from the local mirror.
export const executeLocalReadPlan = async ({
  pg,
  plan,
  sql,
  params,
}: {
  pg: PGlite;
  plan: LocalReadPlan;
  sql: string;
  params: unknown[];
}): Promise<LocalRow[]> => {
  const rows = (await pg.query<LocalRow>(sql, params)).rows;
  const nodes = rows.map((row) => buildNode(row, plan));

  await attachRelations({ pg, plan, rows, nodes });

  return nodes;
};
