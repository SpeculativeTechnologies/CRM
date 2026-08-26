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

let localFirstDatabasePromise: ReturnType<typeof openDatabase> | null = null;

const openDatabase = async () =>
  PGlite.create({
    dataDir: LOCAL_FIRST_DATA_DIR,
    extensions: { live },
  });

// Spike-only singleton: one PGlite instance per tab, lazily opened on first
// use. It must stay a singleton -- two instances on the same IndexedDB dataDir
// block each other. A real implementation would own this in a provider.
export const getLocalFirstDatabase = () => {
  if (!isDefined(localFirstDatabasePromise)) {
    localFirstDatabasePromise = openDatabase();
  }

  return localFirstDatabasePromise;
};

const ensuredTables = new Set<string>();

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
  // the index every local list read hits.
  await pg.exec(
    `create index if not exists "${tableName}_deleted_at_position_idx"
     on "${tableName}" ("deletedAt", position);`,
  );

  ensuredTables.add(tableName);

  return pg;
};
