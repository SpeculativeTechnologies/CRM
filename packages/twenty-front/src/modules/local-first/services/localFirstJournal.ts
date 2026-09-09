import { type PGliteInterface } from '@electric-sql/pglite';
import {
  type LocalFirstChange,
  type LocalFirstChangeResult,
  type LocalFirstValue,
} from 'twenty-shared/types';

import { type LocalFirstJournalEntry } from '@/local-first/types/LocalFirstJournalEntry';

type Connection = Pick<PGliteInterface, 'query' | 'exec'>;
type Document = {
  values: Record<string, LocalFirstValue>;
};

export const initializeLocalFirstJournal = async (database: Connection) => {
  await database.exec(`
    create schema if not exists local_first;
    create table if not exists local_first.documents (
      "objectId" uuid not null, "recordId" uuid not null,
      "values" jsonb not null, primary key ("objectId", "recordId")
    );
    create table if not exists local_first.journal (
      sequence serial primary key, "operationId" uuid not null unique,
      "objectId" uuid not null, "recordId" uuid not null,
      operation jsonb not null, "objectName" text not null,
      "fieldNames" jsonb not null,
      state text not null default 'pending'
        check (state in ('pending','sending','applied','conflict','rejected','superseded')),
      current jsonb, error text, "createdAt" timestamptz not null default now()
    );
    create index if not exists journal_record on local_first.journal ("objectId", "recordId", sequence);
  `);
};

export const readLocalFirstJournal = async (database: Connection) =>
  (
    await database.query<LocalFirstJournalEntry>(
      'select sequence, operation, "objectName", "fieldNames", state, current, error, "createdAt" from local_first.journal order by sequence',
    )
  ).rows;

const saveEntry = async (
  database: Connection,
  operation: LocalFirstChange,
  objectName: string,
  fieldNames: Record<string, string>,
) => {
  await database.query(
    `insert into local_first.journal ("operationId", "objectId", "recordId", operation, "objectName", "fieldNames")
     values ($1, $2, $3, $4, $5, $6)`,
    [
      operation.operationId,
      operation.objectId,
      operation.recordId,
      JSON.stringify(operation),
      objectName,
      JSON.stringify(fieldNames),
    ],
  );
};

// The document and immutable intent are one durable commit. Server snapshots
// and Electric shape resets never touch either table.
export const commitLocalFirstChange = async ({
  database,
  operation,
  objectName,
  fieldNames,
}: {
  database: PGliteInterface;
  operation: LocalFirstChange;
  objectName: string;
  fieldNames: Record<string, string>;
}) => {
  if (
    operation.changes.length === 0 ||
    new Set(operation.changes.map((change) => change.fieldId)).size !==
      operation.changes.length
  ) {
    throw new Error('A local edit needs distinct fields');
  }
  await database.transaction(async (transaction) => {
    const previous = (
      await transaction.query<Document>(
        'select "values" from local_first.documents where "objectId" = $1 and "recordId" = $2',
        [operation.objectId, operation.recordId],
      )
    ).rows[0];
    const active = (
      await transaction.query<{ operation: LocalFirstChange }>(
        `select operation from local_first.journal where "objectId" = $1 and "recordId" = $2
       and state in ('pending','sending','conflict','rejected')`,
        [operation.objectId, operation.recordId],
      )
    ).rows;
    const pendingFields = new Set(
      active.flatMap(({ operation: pending }) =>
        pending.changes.map((change) => change.fieldId),
      ),
    );
    const values = { ...previous?.values };
    for (const change of operation.changes) {
      if (
        pendingFields.has(change.fieldId) &&
        values[change.fieldId] !== change.before
      ) {
        throw new Error(
          'This field changed in another tab. Refresh before editing again.',
        );
      }
      values[change.fieldId] = change.after;
    }
    await transaction.query(
      `insert into local_first.documents ("objectId", "recordId", "values") values ($1, $2, $3)
       on conflict ("objectId", "recordId") do update set "values" = excluded."values"`,
      [operation.objectId, operation.recordId, JSON.stringify(values)],
    );
    await saveEntry(transaction, operation, objectName, fieldNames);
  });
};

export const findNextLocalFirstChange = async (database: Connection) =>
  (
    await database.query<LocalFirstJournalEntry>(
      `select entry.* from local_first.journal entry
     where state in ('pending','sending') and not exists (
       select 1 from local_first.journal earlier
       where earlier."objectId" = entry."objectId" and earlier."recordId" = entry."recordId"
       and earlier.sequence < entry.sequence and earlier.state in ('pending','sending','conflict','rejected')
     ) order by sequence limit 1`,
    )
  ).rows.at(0) ?? null;

export const settleLocalFirstChange = async (
  database: Connection,
  result: LocalFirstChangeResult,
) => {
  await database.query(
    `update local_first.journal set state = $2, current = $3, error = null
     where "operationId" = $1 and state in ('pending','sending')`,
    [
      result.operationId,
      result.status,
      result.status === 'conflict' ? JSON.stringify(result.current) : null,
    ],
  );
};

export const resolveLocalFirstConflict = async ({
  database,
  operationId,
  choice,
  replacementId,
}: {
  database: PGliteInterface;
  operationId: string;
  choice: 'local' | 'server';
  replacementId: string;
}) => {
  await database.transaction(async (transaction) => {
    const entries = await readLocalFirstJournal(transaction);
    const conflict = entries.find(
      (entry) => entry.operation.operationId === operationId,
    );
    if (conflict?.state !== 'conflict' || !conflict.current) {
      throw new Error('This conflict has already been resolved');
    }
    const related = entries.filter(
      (entry) =>
        entry.operation.objectId === conflict.operation.objectId &&
        entry.operation.recordId === conflict.operation.recordId &&
        ['pending', 'conflict', 'rejected'].includes(entry.state),
    );
    const before: Record<string, LocalFirstValue> = {};
    const after: Record<string, LocalFirstValue> = {};
    const fieldNames: Record<string, string> = {};
    for (const entry of related) {
      Object.assign(fieldNames, entry.fieldNames);
      for (const change of entry.operation.changes) {
        if (!Object.hasOwn(before, change.fieldId))
          before[change.fieldId] = change.before;
        after[change.fieldId] = change.after;
      }
    }
    Object.assign(before, conflict.current);
    if (choice === 'server') Object.assign(after, conflict.current);
    const changes = Object.entries(after)
      .filter(([fieldId, value]) => value !== before[fieldId])
      .map(([fieldId, value]) => ({
        fieldId,
        before: before[fieldId],
        after: value,
      }));
    await transaction.query(
      `update local_first.journal set state = 'superseded' where "objectId" = $1 and "recordId" = $2 and state in ('pending','conflict','rejected')`,
      [conflict.operation.objectId, conflict.operation.recordId],
    );
    await transaction.query(
      `update local_first.documents set "values" = "values" || $3::jsonb where "objectId" = $1 and "recordId" = $2`,
      [
        conflict.operation.objectId,
        conflict.operation.recordId,
        JSON.stringify(after),
      ],
    );
    if (changes.length > 0) {
      await saveEntry(
        transaction,
        { ...conflict.operation, operationId: replacementId, changes },
        conflict.objectName,
        fieldNames,
      );
    }
  });
};
