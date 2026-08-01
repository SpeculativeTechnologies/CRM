import { type PGlite } from '@electric-sql/pglite';
import { isDefined } from 'twenty-shared/utils';

import { LOCAL_FIRST_PERSON_COLUMNS } from '@/local-first/constants/LOCAL_FIRST_PERSON_COLUMNS';
import { LOCAL_FIRST_ELECTRIC_URL } from '@/local-first/constants/LOCAL_FIRST_ELECTRIC_URL';
import { LOCAL_FIRST_WORKSPACE_SCHEMA } from '@/local-first/constants/LOCAL_FIRST_WORKSPACE_SCHEMA';
import { getLocalFirstDatabase } from '@/local-first/services/getLocalFirstDatabase';
import { type LocalFirstSyncStatus } from '@/local-first/states/localFirstSyncStatusState';

type ElectricPersonRow = {
  id: string;
  nameFirstName: string | null;
  nameLastName: string | null;
  jobTitle: string | null;
  city: string | null;
  updatedAt: string | null;
};

type ElectricMessage = {
  headers?: { operation?: 'insert' | 'update' | 'delete' };
  value?: ElectricPersonRow;
};

const quotedColumns = LOCAL_FIRST_PERSON_COLUMNS.map(
  (column) => `"${column}"`,
).join(',');

// Hand-rolled polling sync against Electric's HTTP shape API, rather than the
// official @electric-sql/client ShapeStream: in manual browser testing the
// official client never issued a request (no error either), while this same
// request/response cycle worked reliably over plain fetch. Worth revisiting
// once that's root-caused; this is the known-working fallback.
const fetchShapeBatch = async (offset: string, handle: string | null) => {
  const params = new URLSearchParams({
    table: `${LOCAL_FIRST_WORKSPACE_SCHEMA}.person`,
    columns: quotedColumns,
    offset,
  });
  if (isDefined(handle)) params.set('handle', handle);

  const response = await fetch(`${LOCAL_FIRST_ELECTRIC_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Electric responded ${response.status}`);
  }

  const nextOffset = response.headers.get('electric-offset') ?? offset;
  const nextHandle = response.headers.get('electric-handle') ?? handle;
  const upToDate = response.headers.get('electric-up-to-date') !== null;
  const messages = (await response.json()) as ElectricMessage[];

  return { messages, nextOffset, nextHandle, upToDate };
};

const applyMessages = async (pg: PGlite, messages: ElectricMessage[]) => {
  let applied = 0;

  for (const message of messages) {
    const operation = message.headers?.operation;
    const row = message.value;
    if (!isDefined(operation) || !isDefined(row)) continue; // control message, no row payload

    if (operation === 'delete') {
      await pg.query('delete from person where id = $1', [row.id]);
    } else {
      await pg.query(
        `insert into person (id, "nameFirstName", "nameLastName", "jobTitle", city, "updatedAt")
         values ($1,$2,$3,$4,$5,$6)
         on conflict (id) do update set
           "nameFirstName" = excluded."nameFirstName",
           "nameLastName" = excluded."nameLastName",
           "jobTitle" = excluded."jobTitle",
           city = excluded.city,
           "updatedAt" = excluded."updatedAt"`,
        [
          row.id,
          row.nameFirstName,
          row.nameLastName,
          row.jobTitle,
          row.city,
          row.updatedAt,
        ],
      );
    }
    applied += 1;
  }

  return applied;
};

let syncLoopStarted = false;

export const startSyncingPersonShapeToLocalFirstDatabase = ({
  onStatusChange,
}: {
  onStatusChange: (status: LocalFirstSyncStatus) => void;
}) => {
  if (syncLoopStarted || !isDefined(LOCAL_FIRST_WORKSPACE_SCHEMA)) return;
  syncLoopStarted = true;

  let offset = '-1';
  let handle: string | null = null;

  const runLoop = async () => {
    const pg = await getLocalFirstDatabase();

    while (true) {
      try {
        onStatusChange('syncing');
        const batch = await fetchShapeBatch(offset, handle);
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
