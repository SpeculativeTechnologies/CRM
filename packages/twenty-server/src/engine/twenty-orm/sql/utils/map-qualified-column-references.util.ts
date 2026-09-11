// Keep SQL literals, comments and quoted result aliases intact. Values are
// parameterized separately; only qualified identifiers are eligible for mapping.
const SQL_TOKEN =
  /[eE]?'(?:[^'\\]|\\[\s\S]|'')*'|\$(\w*)\$[\s\S]*?\$\1\$|--[^\n]*|\/\*[\s\S]*?\*\/|("(?:[^"]|"")*"|[a-zA-Z_]\w*)\s*\.\s*("(?:[^"]|"")*"|[a-zA-Z_]\w*)|"(?:[^"]|"")*"/g;

const unquote = (identifier: string): string =>
  identifier.startsWith('"')
    ? identifier.slice(1, -1).replace(/""/g, '"')
    : identifier;

export const mapQualifiedColumnReferences = (
  sql: string,
  mapColumn: (alias: string, columnName: string) => string | undefined,
): string =>
  sql.replace(SQL_TOKEN, (token, _dollarTag, alias, columnName) =>
    typeof alias === 'string' && typeof columnName === 'string'
      ? (mapColumn(unquote(alias), unquote(columnName)) ?? token)
      : token,
  );
