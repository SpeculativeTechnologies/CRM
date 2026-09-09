import { ApiPath, type LocalFirstChangeResult } from 'twenty-shared/types';

import {
  assertLocalFirstScopeIsCurrent,
  getCurrentLocalFirstScope,
} from '@/local-first/services/getCurrentLocalFirstScope';
import { getLocalFirstDatabase } from '@/local-first/services/getLocalFirstDatabase';
import { initializeLocalFirstJournal } from '@/local-first/services/localFirstJournal';
import { syncLocalFirstJournal } from '@/local-first/services/syncLocalFirstJournal';
import { getLocalFirstScopeKey } from '@/local-first/utils/getLocalFirstScopeKey';

export const startLocalFirstJournalSync = ({
  onChange,
}: {
  onChange: () => void;
}) => {
  const scope = getCurrentLocalFirstScope();
  if (!scope) return () => {};
  const controller = new AbortController();
  const signal = controller.signal;
  const run = async () => {
    const database = await getLocalFirstDatabase(scope);
    await initializeLocalFirstJournal(database);
    while (!signal.aborted) {
      try {
        await syncLocalFirstJournal({
          database,
          signal,
          assertScope: () => assertLocalFirstScopeIsCurrent(scope),
          send: async (operation) => {
            const response = await fetch(
              `${scope.serverUrl}/${ApiPath.LocalFirst}/changes`,
              {
                method: 'POST',
                credentials: 'include',
                signal,
                headers: {
                  'Content-Type': 'application/json',
                  'X-Twenty-Local-User-Id': scope.userId,
                  'X-Twenty-Local-Workspace-Id': scope.workspaceId,
                },
                body: JSON.stringify(operation),
              },
            );
            assertLocalFirstScopeIsCurrent(scope);
            if (signal.aborted) throw new Error('Local sync stopped');
            if (!response.ok) {
              if ([400, 403, 404, 409, 422].includes(response.status)) {
                await database.query(
                  `update local_first.journal set state = 'rejected', error = $2 where "operationId" = $1`,
                  [
                    operation.operationId,
                    `Server declined this edit (${response.status}). Your local work is retained.`,
                  ],
                );
              }
              throw new Error('Local change could not be synchronized');
            }
            return (await response.json()) as LocalFirstChangeResult;
          },
        });
      } catch {
        // Authentication and transport failures retain the same durable IDs.
      }
      if (signal.aborted) break;
      onChange();
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timeout);
          signal.removeEventListener('abort', finish);
          resolve();
        };
        const timeout = setTimeout(finish, 1500);
        signal.addEventListener('abort', finish, { once: true });
      });
    }
  };
  void navigator.locks
    .request(
      `twenty-local-edits-${getLocalFirstScopeKey(scope)}`,
      { signal },
      run,
    )
    .catch(() => {});
  return () => controller.abort();
};
