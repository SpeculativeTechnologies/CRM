import { isDefined } from 'twenty-shared/utils';
import { type PGliteInterface, type Transaction } from '@electric-sql/pglite';

import { type LocalFirstColumn } from '@/local-first/services/getLocalFirstDatabase';
import { ensureLocalFirstTable } from '@/local-first/services/ensureLocalFirstTable';
import { quoteLocalIdentifier } from '@/local-first/utils/quoteLocalIdentifier';

export type LocalFirstTableState = {
  tableName: string;
  columns: LocalFirstColumn[];
  offset: string;
  handle: string | null;
  complete: boolean;
};

type ReplicaConnection = Pick<PGliteInterface, 'query' | 'exec'>;

export const initializeLocalFirstReplicaState = async (
  pg: ReplicaConnection,
) => {
  await pg.exec(`
    create schema if not exists local_first;
    create table if not exists local_first.table_state (
      "tableName" text primary key,
      columns jsonb not null,
      "offset" text not null default '-1',
      handle text,
      complete boolean not null default false
    );
  `);
};

export const readLocalFirstTableStates = async (pg: ReplicaConnection) =>
  (
    await pg.query<LocalFirstTableState>(
      'select * from local_first.table_state',
    )
  ).rows;

export const ensureLocalFirstReplicaSchema = async ({
  pg,
  tableName,
  columns,
}: {
  pg: PGliteInterface;
  tableName: string;
  columns: LocalFirstColumn[];
}) => {
  await pg.transaction(async (transaction) => {
    const previous = (
      await transaction.query<LocalFirstTableState>(
        'select * from local_first.table_state where "tableName" = $1',
        [tableName],
      )
    ).rows[0];

    if (
      isDefined(previous) &&
      JSON.stringify(previous.columns) === JSON.stringify(columns)
    ) {
      return;
    }

    // These tables contain only replicated server rows. A changed schema
    // invalidates that snapshot; local authored data must use separate tables.
    await transaction.exec(
      `drop table if exists ${quoteLocalIdentifier(tableName)}`,
    );
    await ensureLocalFirstTable({ pg: transaction, tableName, columns });
    await transaction.query(
      `insert into local_first.table_state ("tableName", columns)
       values ($1, $2)
       on conflict ("tableName") do update
       set columns = excluded.columns, "offset" = '-1', handle = null, complete = false`,
      [tableName, JSON.stringify(columns)],
    );
  });
};

export const resetLocalFirstTable = async ({
  pg,
  tableName,
}: {
  pg: PGliteInterface;
  tableName: string;
}) => {
  await pg.transaction(async (transaction) => {
    await transaction.exec(`truncate table ${quoteLocalIdentifier(tableName)}`);
    await transaction.query(
      `update local_first.table_state
       set "offset" = '-1', handle = null, complete = false where "tableName" = $1`,
      [tableName],
    );
  });
};

export const saveLocalFirstCheckpoint = async ({
  transaction,
  tableName,
  offset,
  handle,
  complete,
}: {
  transaction: Transaction;
  tableName: string;
  offset: string;
  handle: string | null;
  complete: boolean;
}) => {
  await transaction.query(
    `update local_first.table_state set "offset" = $2, handle = $3,
     complete = complete or $4 where "tableName" = $1`,
    [tableName, offset, handle, complete],
  );
};
