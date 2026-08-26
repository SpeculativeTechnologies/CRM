import { PGlite } from '@electric-sql/pglite';
import { live } from '@electric-sql/pglite/live';
import { isDefined } from 'twenty-shared/utils';

import { LOCAL_FIRST_PERSON_COLUMN_TYPES } from '@/local-first/constants/LOCAL_FIRST_PERSON_COLUMN_TYPES';
import { LOCAL_FIRST_PERSON_COLUMNS } from '@/local-first/constants/LOCAL_FIRST_PERSON_COLUMNS';

// Bump the suffix when the local table shape changes: `create table if not
// exists` won't migrate an existing IndexedDB database, so a new name is the
// spike's schema-migration story.
const LOCAL_FIRST_DATA_DIR = 'idb://twenty-local-first-v3';

const personColumnDefinitions = LOCAL_FIRST_PERSON_COLUMNS.map(
  (column) => `"${column}" ${LOCAL_FIRST_PERSON_COLUMN_TYPES[column]}`,
).join(', ');

let localFirstDatabasePromise: ReturnType<
  typeof createLocalFirstDatabase
> | null = null;

const createLocalFirstDatabase = async () => {
  const pg = await PGlite.create({
    dataDir: LOCAL_FIRST_DATA_DIR,
    extensions: { live },
  });

  await pg.exec(
    `create table if not exists person (${personColumnDefinitions});`,
  );

  // The standard views page by position and hide soft-deleted rows, so this
  // is the index every local read of person hits.
  await pg.exec(
    'create index if not exists person_deleted_at_position_idx on person ("deletedAt", position);',
  );

  return pg;
};

// Spike-only singleton: one PGlite instance per tab, lazily opened on first
// use. A real implementation would manage this through a provider/context
// instead of module-level state.
export const getLocalFirstDatabase = () => {
  if (!isDefined(localFirstDatabasePromise)) {
    localFirstDatabasePromise = createLocalFirstDatabase();
  }

  return localFirstDatabasePromise;
};
