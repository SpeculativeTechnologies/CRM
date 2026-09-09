import { type PGliteInterface } from '@electric-sql/pglite';
import { ApiPath } from 'twenty-shared/types';

import { LOCAL_FIRST_MIRRORED_TABLES } from '@/local-first/constants/LOCAL_FIRST_MIRRORED_TABLES';
import {
  assertLocalFirstScopeIsCurrent,
  getCurrentLocalFirstScope,
} from '@/local-first/services/getCurrentLocalFirstScope';
import {
  getLocalFirstDatabase,
  type LocalFirstColumn,
} from '@/local-first/services/getLocalFirstDatabase';
import {
  initializeLocalFirstReplicaState,
  readLocalFirstTableStates,
} from '@/local-first/services/localFirstReplicaState';
import { type LocalFirstScope } from '@/local-first/types/LocalFirstScope';
import { getLocalFirstScopeKey } from '@/local-first/utils/getLocalFirstScopeKey';

export type LocalFirstMirror = {
  pg: PGliteInterface;
  scope: LocalFirstScope;
  tables: Record<string, LocalFirstColumn[]>;
  columnsByTable: Record<string, string[]>;
};

const MIRRORS_KEY = '__twentyScopedLocalFirstMirrors';
type MirrorEntry = {
  promise: Promise<LocalFirstMirror>;
  resolved: LocalFirstMirror | null;
};
type MirrorHolder = { [MIRRORS_KEY]?: Map<string, MirrorEntry> };
const getMirrors = () => {
  const holder = globalThis as unknown as MirrorHolder;
  holder[MIRRORS_KEY] ??= new Map();

  return holder[MIRRORS_KEY];
};

export const fetchLocalFirstTableColumns = async ({
  scope,
  tableName,
  signal,
}: {
  scope: LocalFirstScope;
  tableName: string;
  signal?: AbortSignal;
}): Promise<LocalFirstColumn[] | null> => {
  assertLocalFirstScopeIsCurrent(scope);
  const response = await fetch(
    `${scope.serverUrl}/${ApiPath.LocalFirst}/schema/${encodeURIComponent(tableName)}`,
    { credentials: 'include', signal },
  );
  assertLocalFirstScopeIsCurrent(scope);

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Local-first schema responded ${response.status}`);
  }

  const { columns } = (await response.json()) as {
    columns: LocalFirstColumn[];
  };

  return columns;
};

const createMirror = async (
  scope: LocalFirstScope,
): Promise<LocalFirstMirror> => {
  const pg = await getLocalFirstDatabase(scope);
  await initializeLocalFirstReplicaState(pg);
  const states = await readLocalFirstTableStates(pg);
  const tables: Record<string, LocalFirstColumn[]> = {};

  // Bootstrap from durable schema. Starting an already synced replica must
  // not depend on a schema request succeeding while the device is offline.
  for (const tableName of LOCAL_FIRST_MIRRORED_TABLES) {
    const saved = states.find((state) => state.tableName === tableName);
    if (saved) tables[tableName] = saved.columns;
  }

  assertLocalFirstScopeIsCurrent(scope);

  return {
    pg,
    scope,
    tables,
    columnsByTable: Object.fromEntries(
      Object.entries(tables).map(([tableName, columns]) => [
        tableName,
        columns.map((column) => column.name),
      ]),
    ),
  };
};

export const tryGetReadyLocalFirstMirror = (): LocalFirstMirror | null => {
  const scope = getCurrentLocalFirstScope();

  return scope
    ? (getMirrors().get(getLocalFirstScopeKey(scope))?.resolved ?? null)
    : null;
};

const refreshMirrorSchema = async (mirror: LocalFirstMirror) => {
  const states = await readLocalFirstTableStates(mirror.pg);
  assertLocalFirstScopeIsCurrent(mirror.scope);
  const tables: Record<string, LocalFirstColumn[]> = {};
  for (const tableName of LOCAL_FIRST_MIRRORED_TABLES) {
    const saved = states.find((state) => state.tableName === tableName);
    if (saved) tables[tableName] = saved.columns;
  }
  mirror.tables = tables;
  mirror.columnsByTable = Object.fromEntries(
    Object.entries(tables).map(([tableName, columns]) => [
      tableName,
      columns.map((column) => column.name),
    ]),
  );

  return mirror;
};

export const getLocalFirstMirror = () => {
  const scope = getCurrentLocalFirstScope();
  if (!scope) return Promise.reject(new Error('No signed-in local workspace'));

  const key = getLocalFirstScopeKey(scope);
  const mirrors = getMirrors();
  const existing = mirrors.get(key);
  if (existing) return existing.promise.then(refreshMirrorSchema);

  const entry: MirrorEntry = {
    resolved: null,
    promise: createMirror(scope)
      .then((mirror) => {
        entry.resolved = mirror;

        return mirror;
      })
      .catch((error: unknown) => {
        mirrors.delete(key);
        throw error;
      }),
  };
  mirrors.set(key, entry);

  return entry.promise.then(refreshMirrorSchema);
};
