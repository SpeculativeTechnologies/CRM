import { afterEach, beforeEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'expect';
import { PGlite } from '@electric-sql/pglite';
import { NodeFS } from '@electric-sql/pglite/nodefs';
import { type LocalFirstChange } from 'twenty-shared/types';

import {
  commitLocalFirstChange,
  findNextLocalFirstChange,
  initializeLocalFirstJournal,
  readLocalFirstJournal,
  resolveLocalFirstConflict,
  settleLocalFirstChange,
} from '@/local-first/services/localFirstJournal';
import { syncLocalFirstJournal } from '@/local-first/services/syncLocalFirstJournal';

const OBJECT_ID = '00000000-0000-4000-8000-000000000001';
const RECORD_ID = '00000000-0000-4000-8000-000000000002';
const FIELD_ID = '00000000-0000-4000-8000-000000000003';
const SECOND_FIELD_ID = '00000000-0000-4000-8000-000000000004';
const packageDirectory = dirname(
  fileURLToPath(import.meta.resolve('@electric-sql/pglite')),
);
const wasmModule = new WebAssembly.Module(
  new Uint8Array(readFileSync(join(packageDirectory, 'postgres.wasm'))),
);
const fsBundle = new Blob([
  new Uint8Array(readFileSync(join(packageDirectory, 'postgres.data'))),
]);
const openDatabase = (directory: string) =>
  PGlite.create({ fs: new NodeFS(directory), wasmModule, fsBundle });
const change = (after: string, before = 'Original'): LocalFirstChange => ({
  operationId: crypto.randomUUID(),
  objectId: OBJECT_ID,
  recordId: RECORD_ID,
  changes: [{ fieldId: FIELD_ID, before, after }],
});

describe('durable authored edits', () => {
  let directory: string;
  let database: PGlite;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'twenty-journal-'));
    database = await openDatabase(directory);
    await initializeLocalFirstJournal(database);
  });
  afterEach(async () => {
    await database.close();
    await rm(directory, { recursive: true, force: true });
  });
  const commit = (operation: LocalFirstChange) =>
    commitLocalFirstChange({
      database,
      operation,
      objectName: 'person',
      fieldNames: { [FIELD_ID]: 'jobTitle', [SECOND_FIELD_ID]: 'city' },
    });
  const readValue = async () =>
    (
      await database.query<{ value: string }>(
        `select "values" ->> $1 as value from local_first.documents`,
        [FIELD_ID],
      )
    ).rows[0].value;
  const sync = (send: Parameters<typeof syncLocalFirstJournal>[0]['send']) =>
    syncLocalFirstJournal({
      database,
      send,
      signal: new AbortController().signal,
      assertScope: () => {},
    });

  it('should retain the edited value and immutable intent after reopening', async () => {
    const operation = change('Local');
    await commit(operation);
    await database.close();
    database = await openDatabase(directory);
    expect(await readValue()).toBe('Local');
    expect((await readLocalFirstJournal(database))[0]).toMatchObject({
      operation,
      state: 'pending',
    });
  });

  it('should roll back the document when a duplicate operation cannot be journaled', async () => {
    const operation = change('First');
    await commit(operation);
    await expect(
      commit({
        ...operation,
        changes: [{ fieldId: FIELD_ID, before: 'First', after: 'Second' }],
      }),
    ).rejects.toThrow();
    expect(await readValue()).toBe('First');
    expect(await readLocalFirstJournal(database)).toHaveLength(1);
  });

  it('should reject a stale tab edit without losing either intent or an independent field edit', async () => {
    await commit(change('First tab'));
    await expect(commit(change('Stale tab'))).rejects.toThrow('another tab');
    await commit({
      ...change('unused'),
      changes: [{ fieldId: SECOND_FIELD_ID, before: null, after: 'Boston' }],
    });
    expect(await readValue()).toBe('First tab');
    expect(await readLocalFirstJournal(database)).toHaveLength(2);
  });

  it('should retry the same durable ID after a response is lost and apply later edits in order', async () => {
    const first = change('First');
    const second = change('Second', 'First');
    await commit(first);
    await commit(second);
    const serverReceipts = new Set<string>();
    const sent: string[] = [];
    await expect(
      sync(async (operation) => {
        serverReceipts.add(operation.operationId);
        sent.push(operation.operationId);
        throw new Error('Response lost after server commit');
      }),
    ).rejects.toThrow();
    await database.close();
    database = await openDatabase(directory);
    await sync(async (operation) => {
      sent.push(operation.operationId);
      serverReceipts.add(operation.operationId);
      return { status: 'applied', operationId: operation.operationId };
    });
    expect(sent).toEqual([
      first.operationId,
      first.operationId,
      second.operationId,
    ]);
    expect(serverReceipts.size).toBe(2);
    expect(
      (await readLocalFirstJournal(database)).map((entry) => entry.state),
    ).toEqual(['applied', 'applied']);
    expect(await readValue()).toBe('Second');
  });

  it('should block a conflicted record while allowing another record to sync', async () => {
    const first = change('First');
    await commit(first);
    await commit(change('Second', 'First'));
    const independent = { ...change('Other'), recordId: crypto.randomUUID() };
    await commit(independent);
    const sent: string[] = [];
    await sync(async (operation) => {
      sent.push(operation.operationId);
      return operation.operationId === first.operationId
        ? {
            status: 'conflict',
            operationId: operation.operationId,
            current: { [FIELD_ID]: 'Server' },
          }
        : { status: 'applied', operationId: operation.operationId };
    });
    expect(sent).toEqual([first.operationId, independent.operationId]);
    expect(await findNextLocalFirstChange(database)).toBeNull();
    expect(
      (await readLocalFirstJournal(database)).map((entry) => entry.state),
    ).toEqual(['conflict', 'pending', 'applied']);
  });

  it('should retain later local edits when a conflict is resolved in their favor', async () => {
    const first = change('First');
    await commit(first);
    await commit(change('Latest', 'First'));
    await settleLocalFirstChange(database, {
      status: 'conflict',
      operationId: first.operationId,
      current: { [FIELD_ID]: 'Server' },
    });
    const replacementId = crypto.randomUUID();
    await resolveLocalFirstConflict({
      database,
      operationId: first.operationId,
      choice: 'local',
      replacementId,
    });
    const next = await findNextLocalFirstChange(database);
    expect(next?.operation).toMatchObject({
      operationId: replacementId,
      changes: [{ fieldId: FIELD_ID, before: 'Server', after: 'Latest' }],
    });
    expect(
      (await readLocalFirstJournal(database)).map((entry) => entry.state),
    ).toEqual(['superseded', 'superseded', 'pending']);
    expect(await readValue()).toBe('Latest');
  });

  it('should keep independent edits when choosing the server value for a conflicting field', async () => {
    const first = change('Local');
    await commit(first);
    await commit({
      ...change('unused'),
      changes: [{ fieldId: SECOND_FIELD_ID, before: null, after: 'Boston' }],
    });
    await settleLocalFirstChange(database, {
      status: 'conflict',
      operationId: first.operationId,
      current: { [FIELD_ID]: 'Server' },
    });
    await resolveLocalFirstConflict({
      database,
      operationId: first.operationId,
      choice: 'server',
      replacementId: crypto.randomUUID(),
    });
    expect(await readValue()).toBe('Server');
    expect(
      (await findNextLocalFirstChange(database))?.operation.changes,
    ).toEqual([{ fieldId: SECOND_FIELD_ID, before: null, after: 'Boston' }]);
  });

  it('should retain history and reject a second resolution of the same conflict', async () => {
    const first = change('Local');
    await commit(first);
    await settleLocalFirstChange(database, {
      status: 'conflict',
      operationId: first.operationId,
      current: { [FIELD_ID]: 'Server' },
    });
    await resolveLocalFirstConflict({
      database,
      operationId: first.operationId,
      choice: 'server',
      replacementId: crypto.randomUUID(),
    });
    expect(await findNextLocalFirstChange(database)).toBeNull();
    await expect(
      resolveLocalFirstConflict({
        database,
        operationId: first.operationId,
        choice: 'local',
        replacementId: crypto.randomUUID(),
      }),
    ).rejects.toThrow('already been resolved');
    expect(await readValue()).toBe('Server');
    expect(
      (await readLocalFirstJournal(database))[0].operation.changes[0].after,
    ).toBe('Local');
  });

  it('should leave an in-flight edit recoverable when the user switches workspace', async () => {
    const operation = change('Local');
    await commit(operation);
    let currentScope = true;
    await expect(
      syncLocalFirstJournal({
        database,
        signal: new AbortController().signal,
        assertScope: () => {
          if (!currentScope) throw new Error('Workspace changed');
        },
        send: async () => {
          currentScope = false;
          return { status: 'applied', operationId: operation.operationId };
        },
      }),
    ).rejects.toThrow('Workspace changed');
    expect((await readLocalFirstJournal(database))[0].state).toBe('sending');
  });
});
