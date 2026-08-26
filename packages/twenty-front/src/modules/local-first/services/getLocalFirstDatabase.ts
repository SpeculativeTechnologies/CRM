import { PGlite } from '@electric-sql/pglite';
import { live } from '@electric-sql/pglite/live';
import { isDefined } from 'twenty-shared/utils';

// Bump the suffix when the local table shape changes: `create table if not
// exists` won't migrate an existing IndexedDB database, so a new name is the
// spike's schema-migration story.
const LOCAL_FIRST_DATA_DIR = 'idb://twenty-local-first-v2';

let localFirstDatabasePromise: ReturnType<
  typeof createLocalFirstDatabase
> | null = null;

const createLocalFirstDatabase = async () => {
  const pg = await PGlite.create({
    dataDir: LOCAL_FIRST_DATA_DIR,
    extensions: { live },
  });

  await pg.exec(`
    create table if not exists person (
      id uuid primary key,
      "nameFirstName" text,
      "nameLastName" text,
      "jobTitle" text,
      "emailsPrimaryEmail" text,
      "updatedAt" timestamptz
    );
  `);

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
