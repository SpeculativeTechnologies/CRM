const TRUE_LITERALS = new Set(['t', 'true', '1', 'y', 'yes']);
const FALSE_LITERALS = new Set(['f', 'false', '0', 'n', 'no']);

const NUMERIC_DATA_TYPES = new Set([
  'smallint',
  'integer',
  'bigint',
  'numeric',
  'real',
  'double precision',
]);

// Electric serialises values in Postgres' text format, so a boolean arrives as
// the string "false" and a numeric as "1234.5". PGlite's parameter serialiser
// rejects those outright ("Invalid input for boolean type"), which is why
// tables carrying boolean or numeric columns silently synced nothing while
// text/jsonb-only tables worked.
export const coerceValueForLocalColumn = (
  value: unknown,
  dataType: string,
): unknown => {
  if (value === null || value === undefined) return null;

  if (dataType === 'boolean') {
    if (typeof value === 'boolean') return value;

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();

      if (TRUE_LITERALS.has(normalized)) return true;
      if (FALSE_LITERALS.has(normalized)) return false;
    }

    return null;
  }

  if (NUMERIC_DATA_TYPES.has(dataType)) {
    if (typeof value === 'number') return value;

    if (typeof value === 'string') {
      const parsed = Number(value);

      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  return value;
};
