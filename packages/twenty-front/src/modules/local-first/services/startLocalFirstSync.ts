import { isDefined } from 'twenty-shared/utils';
import { ApiPath } from 'twenty-shared/types';

import { IS_LOCAL_FIRST_ENABLED } from '@/local-first/constants/IS_LOCAL_FIRST_ENABLED';
import { LOCAL_FIRST_MIRRORED_TABLES } from '@/local-first/constants/LOCAL_FIRST_MIRRORED_TABLES';
import {
  applyLocalFirstShapeBatch,
  type LocalFirstShapeMessage,
} from '@/local-first/services/applyLocalFirstShapeBatch';
import {
  assertLocalFirstScopeIsCurrent,
  getCurrentLocalFirstScope,
} from '@/local-first/services/getCurrentLocalFirstScope';
import {
  fetchLocalFirstTableColumns,
  getLocalFirstMirror,
  type LocalFirstMirror,
} from '@/local-first/services/getLocalFirstMirror';
import {
  ensureLocalFirstReplicaSchema,
  readLocalFirstTableStates,
  resetLocalFirstTable,
} from '@/local-first/services/localFirstReplicaState';
import { type LocalFirstSyncStatus } from '@/local-first/states/localFirstSyncStatusState';
import { getLocalFirstScopeKey } from '@/local-first/utils/getLocalFirstScopeKey';

const POLL_INTERVAL_MS = 3000;
const SCHEMA_REFRESH_INTERVAL_MS = 60000;

const waitForNextPoll = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const finish = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timeout = setTimeout(finish, POLL_INTERVAL_MS);
    signal.addEventListener('abort', finish, { once: true });
  });

const syncTable = async ({
  mirror,
  tableName,
  signal,
  onStatusChange,
  onTablesResolved,
}: {
  mirror: LocalFirstMirror;
  tableName: string;
  signal: AbortSignal;
  onStatusChange: (status: LocalFirstSyncStatus) => void;
  onTablesResolved: (columnsByTable: Record<string, string[]>) => void;
}) => {
  let schemaCheckedAt = 0;

  while (!signal.aborted) {
    try {
      assertLocalFirstScopeIsCurrent(mirror.scope);
      onStatusChange('syncing');
      if (Date.now() - schemaCheckedAt >= SCHEMA_REFRESH_INTERVAL_MS) {
        const columns = await fetchLocalFirstTableColumns({
          scope: mirror.scope,
          tableName,
          signal,
        });
        if (signal.aborted) return;
        if (!columns) {
          if (isDefined(mirror.tables[tableName]))
            await resetLocalFirstTable({ pg: mirror.pg, tableName });
          delete mirror.tables[tableName];
          delete mirror.columnsByTable[tableName];
          onTablesResolved({ ...mirror.columnsByTable });
          onStatusChange('upToDate');
          await waitForNextPoll(signal);
          continue;
        }
        await ensureLocalFirstReplicaSchema({
          pg: mirror.pg,
          tableName,
          columns,
        });
        mirror.tables[tableName] = columns;
        mirror.columnsByTable[tableName] = columns.map((column) => column.name);
        schemaCheckedAt = Date.now();
        onTablesResolved({ ...mirror.columnsByTable });
      }

      const state = (await readLocalFirstTableStates(mirror.pg)).find(
        (table) => table.tableName === tableName,
      );
      if (!state) throw new Error('Missing local sync checkpoint');
      const params = new URLSearchParams({ offset: state.offset });
      if (state.handle) params.set('handle', state.handle);
      const response = await fetch(
        `${mirror.scope.serverUrl}/${ApiPath.LocalFirst}/shape/${encodeURIComponent(tableName)}?${params}`,
        { credentials: 'include', signal },
      );
      assertLocalFirstScopeIsCurrent(mirror.scope);
      if (signal.aborted) return;
      if (response.status === 409) {
        await resetLocalFirstTable({ pg: mirror.pg, tableName });
        continue;
      }
      if (!response.ok)
        throw new Error(`Local-first sync responded ${response.status}`);
      const offset = response.headers.get('electric-offset');
      const handle = response.headers.get('electric-handle') ?? state.handle;
      const messages = (await response.json()) as LocalFirstShapeMessage[];
      const complete =
        response.headers.has('electric-up-to-date') ||
        messages.some((message) => message.headers?.control === 'up-to-date');
      if (!offset || (!complete && offset === state.offset))
        throw new Error('Missing or unchanged sync offset');
      if (signal.aborted) return;
      assertLocalFirstScopeIsCurrent(mirror.scope);
      await applyLocalFirstShapeBatch({
        pg: mirror.pg,
        tableName,
        columns: state.columns,
        batch: { messages, offset, handle, complete },
      });
      if (complete) {
        onStatusChange('upToDate');
        await waitForNextPoll(signal);
      }
    } catch {
      if (signal.aborted) return;
      onStatusChange('offline');
      await waitForNextPoll(signal);
    }
  }
};

export const startLocalFirstSync = ({
  onStatusChange,
  onTablesResolved,
}: {
  onStatusChange: (status: LocalFirstSyncStatus) => void;
  onTablesResolved: (columnsByTable: Record<string, string[]>) => void;
}) => {
  const controller = new AbortController();
  const scope = getCurrentLocalFirstScope();
  if (!IS_LOCAL_FIRST_ENABLED || !scope) return () => controller.abort();
  const { signal } = controller;

  const run = async () => {
    while (!signal.aborted) {
      try {
        const mirror = await getLocalFirstMirror();
        assertLocalFirstScopeIsCurrent(scope);
        if (signal.aborted) return;
        onTablesResolved({ ...mirror.columnsByTable });
        const statuses = new Map<string, LocalFirstSyncStatus>();
        await Promise.all(
          LOCAL_FIRST_MIRRORED_TABLES.map((tableName) =>
            syncTable({
              mirror,
              tableName,
              signal,
              onTablesResolved,
              onStatusChange: (status) => {
                if (signal.aborted) return;
                statuses.set(tableName, status);
                const values = [...statuses.values()];
                onStatusChange(
                  values.includes('offline')
                    ? 'offline'
                    : values.length === LOCAL_FIRST_MIRRORED_TABLES.length &&
                        values.every((value) => value === 'upToDate')
                      ? 'upToDate'
                      : 'syncing',
                );
              },
            }),
          ),
        );
      } catch {
        if (signal.aborted) return;
        onStatusChange('offline');
        await waitForNextPoll(signal);
      }
    }
  };

  // Only one tab consumes a shape at a time. Other tabs read the worker-backed
  // replica, then take over from the durable checkpoint when its owner closes.
  void navigator.locks
    .request(`twenty-sync-${getLocalFirstScopeKey(scope)}`, { signal }, run)
    .catch(() => {
      if (!signal.aborted) onStatusChange('offline');
    });

  return () => controller.abort();
};
