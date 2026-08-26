import { PGlite } from '@electric-sql/pglite';
import { live } from '@electric-sql/pglite/live';
import { isDefined } from 'twenty-shared/utils';

import { toLocalColumnDefinition } from '@/local-first/utils/toLocalColumnDefinition';

export type LocalFirstColumn = {
  name: string;
  dataType: string;
};

// Bump the suffix when the local table shape changes: `create table if not
// exists` won't migrate an existing IndexedDB database, so a new name is the
// spike's schema-migration story.
const LOCAL_FIRST_DATA_DIR = 'idb://twenty-local-first-v4';

const openDatabase = async () =>
  PGlite.create({
    dataDir: LOCAL_FIRST_DATA_DIR,
    extensions: { live },
  });

// The singleton lives on globalThis, not in module scope: two PGlite instances
// on the same IndexedDB directory block each other forever, and a bundler or
// dev server that hands out two instances of this module (a dynamic import
// resolving to a different URL than a static one, for example) would do
// exactly that. This was not theoretical -- it deadlocked local reads while
// sync kept working, because each side held its own instance.
const DATABASE_SINGLETON_KEY = '__twentyLocalFirstDatabase';

type DatabaseSingletonHolder = {
  [DATABASE_SINGLETON_KEY]?: ReturnType<typeof openDatabase>;
};

export const getLocalFirstDatabase = () => {
  const holder = globalThis as unknown as DatabaseSingletonHolder;

  if (!isDefined(holder[DATABASE_SINGLETON_KEY])) {
    holder[DATABASE_SINGLETON_KEY] = openDatabase();
  }

  return holder[DATABASE_SINGLETON_KEY];
};

// Shared for the same reason as the database handle above.
const ENSURED_TABLES_KEY = '__twentyLocalFirstEnsuredTables';

const getEnsuredTables = (): Set<string> => {
  const holder = globalThis as unknown as {
    [ENSURED_TABLES_KEY]?: Set<string>;
  };

  holder[ENSURED_TABLES_KEY] ??= new Set<string>();

  return holder[ENSURED_TABLES_KEY];
};

// Creates the local mirror of a table from the column list the server reported,
// rather than a hardcoded shape, so every non-generated column of the object
// syncs. Record pages request every field, so a partial mirror can never
// answer a query.
export const ensureLocalFirstTable = async ({
  tableName,
  columns,
}: {
  tableName: string;
  columns: LocalFirstColumn[];
}) => {
  const pg = await getLocalFirstDatabase();

  const ensuredTables = getEnsuredTables();

  if (ensuredTables.has(tableName)) return pg;

  const columnDefinitions = columns
    .map((column) =>
      toLocalColumnDefinition({
        name: column.name,
        dataType: column.dataType,
        isPrimaryKey: column.name === 'id',
      }),
    )
    .join(', ');

  await pg.exec(
    `create table if not exists "${tableName}" (${columnDefinitions});`,
  );

  // Standard views hide soft-deleted rows and order by position, so this is
  // the index local list reads hit. Join objects are looked up by their
  // foreign keys instead, so those get indexed too.
  const columnNames = new Set(columns.map((column) => column.name));
  const indexedColumnSets = [
    ['deletedAt', 'position'],
    ...[...columnNames]
      .filter((column) => column !== 'id' && column.endsWith('Id'))
      .map((column) => [column]),
  ];

  for (const indexedColumns of indexedColumnSets) {
    if (!indexedColumns.every((column) => columnNames.has(column))) continue;

    await pg.exec(
      `create index if not exists "${tableName}_${indexedColumns.join('_')}_idx"
       on "${tableName}" (${indexedColumns.map((column) => `"${column}"`).join(', ')});`,
    );
  }

  ensuredTables.add(tableName);

  return pg;
};
