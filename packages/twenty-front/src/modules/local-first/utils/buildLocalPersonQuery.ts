import { type OrderBy } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

export type LocalPersonQueryTranslation =
  | { isSupported: true; sql: string; params: unknown[] }
  | { isSupported: false; reason: string };

const ORDER_BY_SQL: Record<OrderBy, string> = {
  AscNullsFirst: 'asc nulls first',
  AscNullsLast: 'asc nulls last',
  DescNullsFirst: 'desc nulls first',
  DescNullsLast: 'desc nulls last',
};

// The API hides soft-deleted records unless the caller opts in, and it opts in
// with exactly this filter (see useFindManyRecords). Recognising it is what
// lets the local read agree about deleted rows instead of guessing.
const isSoftDeleteOptInFilter = (filter: Record<string, unknown>): boolean => {
  const orBranches = filter.or;

  if (!Array.isArray(orBranches) || orBranches.length !== 2) return false;

  const branchStates = orBranches.map((branch) => {
    const deletedAt = (branch as Record<string, { is?: string }>)?.deletedAt;

    return deletedAt?.is;
  });

  return (
    branchStates.includes('NULL') &&
    branchStates.includes('NOT_NULL') &&
    orBranches.every((branch) => Object.keys(branch as object).length === 1)
  );
};

const translateOrderBy = (
  orderBy: unknown,
  syncedColumns: Set<string>,
): { orderBySql: string } | { reason: string } => {
  if (!isDefined(orderBy)) return { orderBySql: '' };

  if (!Array.isArray(orderBy)) return { reason: 'orderBy is not an array' };

  if (orderBy.length === 0) return { orderBySql: '' };

  const clauses: string[] = [];

  for (const entry of orderBy) {
    if (typeof entry !== 'object' || entry === null) {
      return { reason: 'orderBy entry is not an object' };
    }

    const entries = Object.entries(entry as Record<string, unknown>);

    if (entries.length !== 1) {
      return { reason: 'orderBy entry does not have exactly one field' };
    }

    const [fieldName, direction] = entries[0];

    if (!syncedColumns.has(fieldName)) {
      return { reason: `orderBy on unsynced field "${fieldName}"` };
    }

    // A nested object here means ordering by a composite subfield or a
    // relation, which this table cannot answer.
    if (typeof direction !== 'string') {
      return { reason: `orderBy on "${fieldName}" is nested` };
    }

    const directionSql = ORDER_BY_SQL[direction as OrderBy];

    if (!isDefined(directionSql)) {
      return { reason: `unknown orderBy direction "${direction}"` };
    }

    clauses.push(`"${fieldName}" ${directionSql}`);
  }

  return { orderBySql: ` order by ${clauses.join(', ')}` };
};

// Translates the variables of a FindManyPeople operation into a query against
// the locally synced person table, or refuses.
//
// Refusing is the important half: a shadow comparison that guesses at a filter
// it cannot express would report divergences that are really translation bugs,
// and a read path built on it would silently serve wrong rows. Anything
// outside the supported subset returns isSupported: false with a reason.
export const buildLocalPersonQuery = ({
  filter,
  orderBy,
  limit,
  offset,
  cursorFilter,
  selectColumns,
  orderableColumns,
}: {
  filter?: unknown;
  orderBy?: unknown;
  limit?: unknown;
  offset?: unknown;
  cursorFilter?: unknown;
  // Columns the plan needs selected.
  selectColumns: readonly string[];
  // Columns that exist on the table, which ordering may reference even when
  // the query does not display them.
  orderableColumns: readonly string[];
}): LocalPersonQueryTranslation => {
  if (selectColumns.length === 0) {
    return { isSupported: false, reason: 'no columns to select' };
  }

  if (isDefined(cursorFilter)) {
    return { isSupported: false, reason: 'cursor pagination' };
  }

  let whereSql = ' where "deletedAt" is null';

  if (isDefined(filter) && Object.keys(filter as object).length > 0) {
    if (!isSoftDeleteOptInFilter(filter as Record<string, unknown>)) {
      return { isSupported: false, reason: 'unsupported filter' };
    }

    whereSql = '';
  }

  const orderByResult = translateOrderBy(orderBy, new Set(orderableColumns));

  if ('reason' in orderByResult) {
    return { isSupported: false, reason: orderByResult.reason };
  }

  const params: unknown[] = [];
  let limitSql = '';
  let offsetSql = '';

  if (isDefined(limit)) {
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 0) {
      return { isSupported: false, reason: 'non-integer limit' };
    }

    params.push(limit);
    limitSql = ` limit $${params.length}`;
  }

  if (isDefined(offset)) {
    if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
      return { isSupported: false, reason: 'non-integer offset' };
    }

    params.push(offset);
    offsetSql = ` offset $${params.length}`;
  }

  return {
    isSupported: true,
    sql: `select ${selectColumns.map((column) => `"${column}"`).join(', ')} from person${whereSql}${orderByResult.orderBySql}${limitSql}${offsetSql}`,
    params,
  };
};
