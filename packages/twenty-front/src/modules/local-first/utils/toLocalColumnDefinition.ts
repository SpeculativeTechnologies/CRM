// Maps an information_schema data_type to the DDL used for the local mirror.
// Anything unrecognised becomes text: the local copy only has to sort, filter
// and render the same way the server did, and unknown types are safer as text
// than as a guess that changes ordering semantics.
const LOCAL_COLUMN_TYPES: Record<string, string> = {
  uuid: 'uuid',
  text: 'text',
  'character varying': 'text',
  boolean: 'boolean',
  integer: 'integer',
  bigint: 'bigint',
  smallint: 'smallint',
  numeric: 'numeric',
  'double precision': 'double precision',
  real: 'real',
  'timestamp with time zone': 'timestamptz',
  'timestamp without time zone': 'timestamp',
  date: 'date',
  jsonb: 'jsonb',
  json: 'jsonb',
  ARRAY: 'text[]',
};

export const toLocalColumnType = (dataType: string): string =>
  LOCAL_COLUMN_TYPES[dataType] ?? 'text';

export const toLocalColumnDefinition = ({
  name,
  dataType,
  isPrimaryKey,
}: {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
}): string => {
  const localType = toLocalColumnType(dataType);

  return `"${name}" ${localType}${isPrimaryKey ? ' primary key' : ''}`;
};
