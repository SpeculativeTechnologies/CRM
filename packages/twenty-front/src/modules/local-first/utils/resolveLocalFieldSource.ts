export type LocalFieldSource = {
  column: string;
  // Set when the value lives inside a jsonb column rather than its own column.
  jsonKey: string | null;
};

const toCompositeColumnName = (fieldName: string, subFieldName: string) =>
  `${fieldName}${subFieldName.charAt(0).toUpperCase()}${subFieldName.slice(1)}`;

// Where a requested API field lives in the local mirror. Composites flatten
// two different ways in this schema and both have to be handled: name
// { firstName } is stored as the column nameFirstName, while avatarFile
// { url } is a single jsonb column holding the whole object. Returns null when
// the field is not in the mirror at all.
export const resolveLocalFieldSource = ({
  fieldName,
  subFieldName,
  syncedColumns,
}: {
  fieldName: string;
  subFieldName?: string;
  syncedColumns: ReadonlySet<string>;
}): LocalFieldSource | null => {
  if (subFieldName === undefined) {
    return syncedColumns.has(fieldName)
      ? { column: fieldName, jsonKey: null }
      : null;
  }

  const flattenedColumn = toCompositeColumnName(fieldName, subFieldName);

  if (syncedColumns.has(flattenedColumn)) {
    return { column: flattenedColumn, jsonKey: null };
  }

  if (syncedColumns.has(fieldName)) {
    return { column: fieldName, jsonKey: subFieldName };
  }

  return null;
};

export const readLocalFieldValue = ({
  record,
  source,
}: {
  record: Record<string, unknown>;
  source: LocalFieldSource;
}): unknown => {
  const columnValue = record[source.column];

  if (source.jsonKey === null) return columnValue;

  if (typeof columnValue !== 'object' || columnValue === null) return null;

  return (columnValue as Record<string, unknown>)[source.jsonKey];
};
