import { type PGlite, type Transaction } from '@electric-sql/pglite';
import { ApiPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { IS_LOCAL_FIRST_ENABLED } from '@/local-first/constants/IS_LOCAL_FIRST_ENABLED';
import { LOCAL_FIRST_PERSON_COLUMNS } from '@/local-first/constants/LOCAL_FIRST_PERSON_COLUMNS';
import { getLocalFirstDatabase } from '@/local-first/services/getLocalFirstDatabase';
import { type LocalFirstSyncStatus } from '@/local-first/states/localFirstSyncStatusState';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type ElectricPersonRow = {
  id: string;
  nameFirstName: string | null;
  nameLastName: string | null;
  jobTitle: string | null;
  emailsPrimaryEmail: string | null;
  updatedAt: string | null;
};

type ElectricMessage = {
  headers?: { operation?: 'insert' | 'update' | 'delete' };
  value?: ElectricPersonRow;
};

const UPSERT_BATCH_SIZE = 500;

// The shape request goes through the server's local-first proxy, which
// resolves the caller's workspace schema from their auth and forwards to
// Electric — the browser never talks to Electric directly and never names a
// schema or column list.
//
// Hand-rolled polling sync rather than the official @electric-sql/client
// ShapeStream: in manual browser testing the official client never issued a
// request (no error either), while this same request/response cycle worked
// reliably over plain fetch. Worth revisiting once that's root-caused; this
// is the known-working fallback.
const fetchShapeBatch = async ({
  offset,
  handle,
  getAuthHeaders,
}: {
  offset: string;
  handle: string | null;
  getAuthHeaders: () => Record<string, string>;
}) => {
  const params = new URLSearchParams({ offset });
  if (isDefined(handle)) params.set('handle', handle);

  const response = await fetch(
    `${REACT_APP_SERVER_BASE_URL}/${ApiPath.LocalFirst}/shape/person?${params}`,
    {
      credentials: 'include',
      headers: getAuthHeaders(),
    },
  );
  if (!response.ok) {
    throw new Error(`Local-first shape proxy responded ${response.status}`);
  }

  const nextOffset = response.headers.get('electric-offset') ?? offset;
  const nextHandle = response.headers.get('electric-handle') ?? handle;
  const upToDate = response.headers.get('electric-up-to-date') !== null;

  // A response whose sync headers are unreadable (e.g. not CORS-exposed)
  // would otherwise re-fetch the whole shape from offset -1 in a tight loop.
  if (!upToDate && nextOffset === offset) {
    throw new Error('Shape response did not advance the sync offset');
  }

  const messages = (await response.json()) as ElectricMessage[];

  return { messages, nextOffset, nextHandle, upToDate };
};

const upsertPersonRows = async (tx: Transaction, rows: ElectricPersonRow[]) => {
  const columnCount = LOCAL_FIRST_PERSON_COLUMNS.length;
  const valuesSql = rows
    .map(
      (_, rowIndex) =>
        `(${LOCAL_FIRST_PERSON_COLUMNS.map(
          (_, columnIndex) => `$${rowIndex * columnCount + columnIndex + 1}`,
        ).join(',')})`,
    )
    .join(',');

  await tx.query(
    `insert into person (id, "nameFirstName", "nameLastName", "jobTitle", "emailsPrimaryEmail", "updatedAt")
     values ${valuesSql}
     on conflict (id) do update set
       "nameFirstName" = excluded."nameFirstName",
       "nameLastName" = excluded."nameLastName",
       "jobTitle" = excluded."jobTitle",
       "emailsPrimaryEmail" = excluded."emailsPrimaryEmail",
       "updatedAt" = excluded."updatedAt"`,
    rows.flatMap((row) => [
      row.id,
      row.nameFirstName,
      row.nameLastName,
      row.jobTitle,
      row.emailsPrimaryEmail,
      row.updatedAt,
    ]),
  );
};

// Applies a shape batch in one transaction, batching consecutive upserts into
// multi-row inserts (row-by-row inserts made the initial sync take minutes).
// Message order is preserved: an upsert buffer is flushed before any delete,
// so delete-then-reinsert sequences replay correctly.
const applyMessages = async (pg: PGlite, messages: ElectricMessage[]) => {
  let applied = 0;

  await pg.transaction(async (tx) => {
    let upsertBuffer: ElectricPersonRow[] = [];

    const flushUpserts = async () => {
      if (upsertBuffer.length === 0) return;
      await upsertPersonRows(tx, upsertBuffer);
      applied += upsertBuffer.length;
      upsertBuffer = [];
    };

    for (const message of messages) {
      const operation = message.headers?.operation;
      const row = message.value;
      if (!isDefined(operation) || !isDefined(row)) continue; // control message, no row payload

      if (operation === 'delete') {
        await flushUpserts();
        await tx.query('delete from person where id = $1', [row.id]);
        applied += 1;
      } else {
        upsertBuffer.push(row);
        if (upsertBuffer.length >= UPSERT_BATCH_SIZE) {
          await flushUpserts();
        }
      }
    }

    await flushUpserts();
  });

  return applied;
};

let syncLoopStarted = false;

export const startSyncingPersonShapeToLocalFirstDatabase = ({
  onStatusChange,
  getAuthHeaders,
}: {
  onStatusChange: (status: LocalFirstSyncStatus) => void;
  getAuthHeaders: () => Record<string, string>;
}) => {
  if (syncLoopStarted || !IS_LOCAL_FIRST_ENABLED) return;
  syncLoopStarted = true;

  let offset = '-1';
  let handle: string | null = null;

  const runLoop = async () => {
    const pg = await getLocalFirstDatabase();

    while (true) {
      try {
        onStatusChange('syncing');
        const batch = await fetchShapeBatch({ offset, handle, getAuthHeaders });
        offset = batch.nextOffset;
        handle = batch.nextHandle;
        await applyMessages(pg, batch.messages);

        if (batch.upToDate) {
          onStatusChange('upToDate');
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      } catch {
        onStatusChange('offline');
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  };

  runLoop();
};
