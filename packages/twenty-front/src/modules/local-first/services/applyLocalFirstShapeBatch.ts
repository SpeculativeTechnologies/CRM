import { type PGliteInterface } from '@electric-sql/pglite';

import { type LocalFirstColumn } from '@/local-first/services/getLocalFirstDatabase';
import { saveLocalFirstCheckpoint } from '@/local-first/services/localFirstReplicaState';
import { coerceValueForLocalColumn } from '@/local-first/utils/coerceValueForLocalColumn';
import { quoteLocalIdentifier } from '@/local-first/utils/quoteLocalIdentifier';

export type LocalFirstShapeMessage = {
  headers?: { operation?: 'insert' | 'update' | 'delete'; control?: string };
  value?: Record<string, unknown>;
};

export type LocalFirstShapeBatch = {
  messages: LocalFirstShapeMessage[];
  offset: string;
  handle: string | null;
  complete: boolean;
};

export const applyLocalFirstShapeBatch = async ({
  pg,
  tableName,
  columns,
  batch,
}: {
  pg: PGliteInterface;
  tableName: string;
  columns: LocalFirstColumn[];
  batch: LocalFirstShapeBatch;
}) => {
  await pg.transaction(async (transaction) => {
    // Flush repeated record IDs separately: Postgres rejects updating the
    // same row twice within one INSERT ... ON CONFLICT statement.
    let pendingRows = new Map<unknown, Record<string, unknown>>();
    const flush = async () => {
      if (pendingRows.size === 0) return;
      const rows = [...pendingRows.values()];
      const assignments = columns
        .filter((column) => column.name !== 'id')
        .map(
          (column) =>
            `${quoteLocalIdentifier(column.name)} = excluded.${quoteLocalIdentifier(column.name)}`,
        )
        .join(', ');
      const values = rows.map(
        (_row, rowIndex) =>
          `(${columns.map((_column, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`).join(', ')})`,
      );
      await transaction.query(
        `insert into ${quoteLocalIdentifier(tableName)} (${columns.map((column) => quoteLocalIdentifier(column.name)).join(', ')})
         values ${values.join(', ')} on conflict (id) ${assignments ? `do update set ${assignments}` : 'do nothing'}`,
        rows.flatMap((row) =>
          columns.map((column) =>
            coerceValueForLocalColumn(row[column.name], column.dataType),
          ),
        ),
      );
      pendingRows = new Map();
    };

    for (const message of batch.messages) {
      const operation = message.headers?.operation;
      const row = message.value;
      if (!operation || !row) continue;

      if (operation === 'delete') {
        await flush();
        await transaction.query(
          `delete from ${quoteLocalIdentifier(tableName)} where id = $1`,
          [row.id],
        );
      } else if (operation === 'update') {
        await flush();
        const changedColumns = columns.filter(
          (column) => column.name !== 'id' && Object.hasOwn(row, column.name),
        );
        if (changedColumns.length === 0) continue;
        const result = await transaction.query(
          `update ${quoteLocalIdentifier(tableName)} set ${changedColumns.map((column, index) => `${quoteLocalIdentifier(column.name)} = $${index + 2}`).join(', ')} where id = $1 returning id`,
          [
            row.id,
            ...changedColumns.map((column) =>
              coerceValueForLocalColumn(row[column.name], column.dataType),
            ),
          ],
        );
        if (result.rows.length !== 1)
          throw new Error('A shape update referenced a missing local row');
      } else {
        if (pendingRows.has(row.id)) await flush();
        pendingRows.set(row.id, row);
        // Stay below Postgres's parameter limit for wide custom objects.
        if (
          pendingRows.size >= Math.min(500, Math.floor(60000 / columns.length))
        )
          await flush();
      }
    }

    await flush();
    // A crash or failed row never advances the durable checkpoint without
    // its rows, or commits rows without the corresponding checkpoint.
    await saveLocalFirstCheckpoint({ transaction, tableName, ...batch });
  });
};
