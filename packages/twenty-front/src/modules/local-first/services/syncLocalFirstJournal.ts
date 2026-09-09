import { type PGliteInterface } from '@electric-sql/pglite';
import {
  type LocalFirstChange,
  type LocalFirstChangeResult,
} from 'twenty-shared/types';

import {
  findNextLocalFirstChange,
  settleLocalFirstChange,
} from '@/local-first/services/localFirstJournal';
import { parseLocalFirstChangeResult } from '@/local-first/utils/parseLocalFirstChangeResult';

export type LocalFirstChangeTransport = (
  change: LocalFirstChange,
  signal: AbortSignal,
) => Promise<LocalFirstChangeResult>;

// A lost response leaves the exact operation intact. Retrying the same ID is
// safe because the server commits its receipt in the record transaction.
export const syncLocalFirstJournal = async ({
  database,
  send,
  signal,
  assertScope,
}: {
  database: PGliteInterface;
  send: LocalFirstChangeTransport;
  signal: AbortSignal;
  assertScope: () => void;
}) => {
  while (!signal.aborted) {
    assertScope();
    const entry = await findNextLocalFirstChange(database);
    if (!entry) return;
    assertScope();
    if (signal.aborted) return;
    await database.query(
      `update local_first.journal set state = 'sending' where "operationId" = $1`,
      [entry.operation.operationId],
    );
    const result = await send(entry.operation, signal);
    assertScope();
    if (signal.aborted) return;
    await settleLocalFirstChange(
      database,
      parseLocalFirstChangeResult(result, entry.operation),
    );
  }
};
