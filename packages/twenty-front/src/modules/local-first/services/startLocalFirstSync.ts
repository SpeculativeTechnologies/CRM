import { type PGlite, type Transaction } from '@electric-sql/pglite';
import { ApiPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { IS_LOCAL_FIRST_ENABLED } from '@/local-first/constants/IS_LOCAL_FIRST_ENABLED';
import { type LocalFirstColumn } from '@/local-first/services/getLocalFirstDatabase';
import { getLocalFirstMirror } from '@/local-first/services/getLocalFirstMirror';
import { type LocalFirstSyncStatus } from '@/local-first/states/localFirstSyncStatusState';
import { coerceValueForLocalColumn } from '@/local-first/utils/coerceValueForLocalColumn';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type ElectricRow = Record<string, string | number | boolean | null>;

type ElectricMessage = {
  headers?: { operation?: 'insert' | 'update' | 'delete' };
  value?: ElectricRow;
};

const UPSERT_BATCH_SIZE = 500;
const POLL_INTERVAL_MS = 3000;

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
  tableName,
  offset,
  handle,
}: {
  tableName: string;
  offset: string;
  handle: string | null;
}) => {
  const params = new URLSearchParams({ offset });
  if (isDefined(handle)) params.set('handle', handle);

  const response = await fetch(
    `${REACT_APP_SERVER_BASE_URL}/${ApiPath.LocalFirst}/shape/${tableName}?${params}`,
    {
      credentials: 'include',
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

const buildUpsertStatement = ({
  tableName,
  columns,
  rowCount,
}: {
  tableName: string;
  columns: LocalFirstColumn[];
  rowCount: number;
}) => {
  const quotedColumns = columns.map((column) => `"${column.name}"`).join(', ');
  const assignments = columns
    .filter((column) => column.name !== 'id')
    .map((column) => `"${column.name}" = excluded."${column.name}"`)
    .join(', ');

  const valuesSql = Array.from({ length: rowCount }, (_, rowIndex) => {
    const placeholders = columns.map(
      (_column, columnIndex) =>
        `$${rowIndex * columns.length + columnIndex + 1}`,
    );

    return `(${placeholders.join(',')})`;
  }).join(',');

  return `insert into "${tableName}" (${quotedColumns})
          values ${valuesSql}
          on conflict (id) do update set ${assignments}`;
};

// Applies a shape batch in one transaction, batching consecutive upserts into
// multi-row inserts (row-by-row inserts made the initial sync take minutes).
// Message order is preserved: an upsert buffer is flushed before any delete,
// so delete-then-reinsert sequences replay correctly.
const applyMessages = async ({
  pg,
  tableName,
  columns,
  messages,
}: {
  pg: PGlite;
  tableName: string;
  columns: LocalFirstColumn[];
  messages: ElectricMessage[];
}) => {
  await pg.transaction(async (tx: Transaction) => {
    let upsertBuffer: ElectricRow[] = [];

    const flushUpserts = async () => {
      if (upsertBuffer.length === 0) return;

      await tx.query(
        buildUpsertStatement({
          tableName,
          columns,
          rowCount: upsertBuffer.length,
        }),
        upsertBuffer.flatMap((row) =>
          columns.map((column) =>
            coerceValueForLocalColumn(row[column.name], column.dataType),
          ),
        ),
      );

      upsertBuffer = [];
    };

    for (const message of messages) {
      const operation = message.headers?.operation;
      const row = message.value;
      if (!isDefined(operation) || !isDefined(row)) continue; // control message, no row payload

      if (operation === 'delete') {
        await flushUpserts();
        await tx.query(`delete from "${tableName}" where id = $1`, [row.id]);
      } else {
        upsertBuffer.push(row);
        if (upsertBuffer.length >= UPSERT_BATCH_SIZE) {
          await flushUpserts();
        }
      }
    }

    await flushUpserts();
  });
};

const syncTableForever = async ({
  pg,
  tableName,
  columns,
  onTableStatusChange,
}: {
  pg: PGlite;
  tableName: string;
  columns: LocalFirstColumn[];
  onTableStatusChange: (status: LocalFirstSyncStatus) => void;
}) => {
  let offset = '-1';
  let handle: string | null = null;

  while (true) {
    try {
      onTableStatusChange('syncing');

      const batch = await fetchShapeBatch({ tableName, offset, handle });

      // Applied before the offset advances: advancing first meant a failed
      // apply skipped that batch permanently.
      await applyMessages({
        pg,
        tableName,
        columns,
        messages: batch.messages,
      });

      offset = batch.nextOffset;
      handle = batch.nextHandle;

      if (batch.upToDate) {
        onTableStatusChange('upToDate');
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch {
      onTableStatusChange('offline');
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
};

let syncStarted = false;

// One independent loop per mirrored table. They are deliberately not
// coordinated: a table that fails or lags does not stall the others, and the
// coverage check refuses reads that would need a table that is not ready.
export const startLocalFirstSync = ({
  onStatusChange,
  onTablesResolved,
}: {
  onStatusChange: (status: LocalFirstSyncStatus) => void;
  onTablesResolved: (columnsByTable: Record<string, string[]>) => void;
}) => {
  if (syncStarted || !IS_LOCAL_FIRST_ENABLED) return;
  syncStarted = true;

  const run = async () => {
    while (true) {
      try {
        onStatusChange('syncing');

        const { pg, tables, columnsByTable } = await getLocalFirstMirror();

        onTablesResolved(columnsByTable);

        const tableStatuses = new Map<string, LocalFirstSyncStatus>();
        const tableNames = Object.keys(tables);

        // The headline status is the least-advanced table, so the panel does
        // not claim to be up to date while something is still streaming.
        const publishAggregateStatus = () => {
          const statuses = [...tableStatuses.values()];

          if (statuses.includes('offline')) return onStatusChange('offline');
          if (statuses.includes('syncing')) return onStatusChange('syncing');
          if (
            statuses.length === tableNames.length &&
            statuses.every((status) => status === 'upToDate')
          ) {
            return onStatusChange('upToDate');
          }

          return onStatusChange('syncing');
        };

        await Promise.all(
          tableNames.map((tableName) =>
            syncTableForever({
              pg,
              tableName,
              columns: tables[tableName],
              onTableStatusChange: (status) => {
                tableStatuses.set(tableName, status);
                publishAggregateStatus();
              },
            }),
          ),
        );
      } catch {
        onStatusChange('offline');
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }
  };

  run();
};
