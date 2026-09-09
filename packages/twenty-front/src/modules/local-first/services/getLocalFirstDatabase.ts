import { type PGliteInterface } from '@electric-sql/pglite';
import { live } from '@electric-sql/pglite/live';
import { PGliteWorker } from '@electric-sql/pglite/worker';

import { type LocalFirstScope } from '@/local-first/types/LocalFirstScope';
import { getLocalFirstScopeKey } from '@/local-first/utils/getLocalFirstScopeKey';
import LocalFirstDatabaseWorker from '@/local-first/workers/localFirstDatabase.worker?worker';

export type LocalFirstColumn = {
  name: string;
  dataType: string;
};

// Keep replica identity across duplicate modules and HMR. Worker election also
// makes concurrent tabs share one database instead of competing over IndexedDB.
const DATABASES_KEY = '__twentyScopedLocalFirstDatabases';
type DatabaseHolder = {
  [DATABASES_KEY]?: Map<string, Promise<PGliteInterface>>;
};

const getDatabases = () => {
  const holder = globalThis as unknown as DatabaseHolder;
  holder[DATABASES_KEY] ??= new Map();

  return holder[DATABASES_KEY];
};

export const getLocalFirstDatabase = (scope: LocalFirstScope) => {
  const key = getLocalFirstScopeKey(scope);
  const databases = getDatabases();
  const existing = databases.get(key);

  if (existing) return existing;

  const databaseWorker = new LocalFirstDatabaseWorker();
  const promise = PGliteWorker.create(databaseWorker, {
    id: key,
    dataDir: `idb://twenty-local-first-v5-${key}`,
    extensions: { live },
  }).catch((error: unknown) => {
    databaseWorker.terminate();
    databases.delete(key);
    throw error;
  });

  databases.set(key, promise);

  return promise;
};
