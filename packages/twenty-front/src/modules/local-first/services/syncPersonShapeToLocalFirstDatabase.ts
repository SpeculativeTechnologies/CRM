import { type PGlite, type Transaction } from '@electric-sql/pglite';
import { ApiPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { IS_LOCAL_FIRST_ENABLED } from '@/local-first/constants/IS_LOCAL_FIRST_ENABLED';
import {
  getLocalFirstPersonMirror,
  LOCAL_FIRST_PERSON_TABLE,
} from '@/local-first/services/getLocalFirstPersonMirror';
import { type LocalFirstSyncStatus } from '@/local-first/states/localFirstSyncStatusState';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type ElectricRow = Record<string, string | number | boolean | null>;

type ElectricMessage = {
  headers?: { operation?: 'insert' | 'update' | 'delete' };
  value?: ElectricRow;
};

const UPSERT_BATCH_SIZE = 500;
const POLL_INTERVAL_MS = 3000;

const localFirstUrl = (path: string) =>
  `${REACT_APP_SERVER_BASE_URL}/${ApiPath.LocalFirst}/${path}`;

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
    `${localFirstUrl(`shape/${LOCAL_FIRST_PERSON_TABLE}`)}?${params}`,
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

const buildUpsertStatement = (columnNames: string[], rowCount: number) => {
  const quotedColumns = columnNames.map((column) => `"${column}"`).join(', ');
  const assignments = columnNames
    .filter((column) => column !== 'id')
    .map((column) => `"${column}" = excluded."${column}"`)
    .join(', ');

  const valuesSql = Array.from({ length: rowCount }, (_, rowIndex) => {
    const placeholders = columnNames.map(
      (_column, columnIndex) =>
        `$${rowIndex * columnNames.length + columnIndex + 1}`,
    );

    return `(${placeholders.join(',')})`;
  }).join(',');

  return `insert into "${LOCAL_FIRST_PERSON_TABLE}" (${quotedColumns})
          values ${valuesSql}
          on conflict (id) do update set ${assignments}`;
};

// Applies a shape batch in one transaction, batching consecutive upserts into
// multi-row inserts (row-by-row inserts made the initial sync take minutes).
// Message order is preserved: an upsert buffer is flushed before any delete,
// so delete-then-reinsert sequences replay correctly.
const applyMessages = async ({
  pg,
  messages,
  columnNames,
}: {
  pg: PGlite;
  messages: ElectricMessage[];
  columnNames: string[];
}) => {
  let applied = 0;

  await pg.transaction(async (tx: Transaction) => {
    let upsertBuffer: ElectricRow[] = [];

    const flushUpserts = async () => {
      if (upsertBuffer.length === 0) return;

      await tx.query(
        buildUpsertStatement(columnNames, upsertBuffer.length),
        upsertBuffer.flatMap((row) =>
          columnNames.map((column) => row[column] ?? null),
        ),
      );

      applied += upsertBuffer.length;
      upsertBuffer = [];
    };

    for (const message of messages) {
      const operation = message.headers?.operation;
      const row = message.value;
      if (!isDefined(operation) || !isDefined(row)) continue; // control message, no row payload

      if (operation === 'delete') {
        await flushUpserts();
        await tx.query(
          `delete from "${LOCAL_FIRST_PERSON_TABLE}" where id = $1`,
          [row.id],
        );
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
  onColumnsResolved,
  getAuthHeaders,
}: {
  onStatusChange: (status: LocalFirstSyncStatus) => void;
  onColumnsResolved: (columnNames: string[]) => void;
  getAuthHeaders: () => Record<string, string>;
}) => {
  if (syncLoopStarted || !IS_LOCAL_FIRST_ENABLED) return;
  syncLoopStarted = true;

  let offset = '-1';
  let handle: string | null = null;

  const runLoop = async () => {
    let pg: PGlite | null = null;
    let columnNames: string[] = [];

    while (true) {
      try {
        onStatusChange('syncing');

        // The local table is built from the server's column list, so this has
        // to succeed before any row can be applied.
        if (!isDefined(pg)) {
          const mirror = await getLocalFirstPersonMirror();

          pg = mirror.pg;
          columnNames = mirror.columnNames;
          onColumnsResolved(columnNames);
        }

        const batch = await fetchShapeBatch({ offset, handle, getAuthHeaders });

        offset = batch.nextOffset;
        handle = batch.nextHandle;
        await applyMessages({ pg, messages: batch.messages, columnNames });

        if (batch.upToDate) {
          onStatusChange('upToDate');
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } catch {
        onStatusChange('offline');
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }
  };

  runLoop();
};
