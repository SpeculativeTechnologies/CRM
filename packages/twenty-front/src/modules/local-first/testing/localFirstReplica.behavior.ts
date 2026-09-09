import { afterEach, beforeEach, describe, it } from 'node:test';
import { expect } from 'expect';

import { PGlite } from '@electric-sql/pglite';
import { NodeFS } from '@electric-sql/pglite/nodefs';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyLocalFirstShapeBatch } from '@/local-first/services/applyLocalFirstShapeBatch';
import {
  ensureLocalFirstReplicaSchema,
  initializeLocalFirstReplicaState,
  readLocalFirstTableStates,
  resetLocalFirstTable,
} from '@/local-first/services/localFirstReplicaState';

const COLUMNS = [
  { name: 'id', dataType: 'uuid' },
  { name: 'label', dataType: 'text' },
  { name: 'priority', dataType: 'integer' },
];
const RECORD_ID = '00000000-0000-4000-8000-000000000001';

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

describe('durable local replica', () => {
  let directory: string;
  let database: PGlite;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'twenty-replica-'));
    database = await openDatabase(directory);
    await initializeLocalFirstReplicaState(database);
    await ensureLocalFirstReplicaSchema({
      pg: database,
      tableName: 'person',
      columns: COLUMNS,
    });
  });

  afterEach(async () => {
    await database.close();
    await rm(directory, { recursive: true, force: true });
  });

  const apply = (
    messages: Parameters<
      typeof applyLocalFirstShapeBatch
    >[0]['batch']['messages'],
    offset = '1_0',
    complete = true,
  ) =>
    applyLocalFirstShapeBatch({
      pg: database,
      tableName: 'person',
      columns: COLUMNS,
      batch: { messages, offset, handle: 'shape-1', complete },
    });

  it('should preserve rows, schema and completed checkpoint after reopening the database', async () => {
    await apply([
      {
        headers: { operation: 'insert' },
        value: { id: RECORD_ID, label: 'Example', priority: '3' },
      },
    ]);
    await database.close();
    database = await openDatabase(directory);
    expect(
      (await database.query('select label, priority from person')).rows,
    ).toEqual([{ label: 'Example', priority: 3 }]);
    expect(await readLocalFirstTableStates(database)).toEqual([
      {
        tableName: 'person',
        columns: COLUMNS,
        offset: '1_0',
        handle: 'shape-1',
        complete: true,
      },
    ]);
  });

  it('should roll back every row and its checkpoint when a batch cannot be applied', async () => {
    await expect(
      apply([
        {
          headers: { operation: 'insert' },
          value: { id: RECORD_ID, label: 'Example', priority: '3' },
        },
        {
          headers: { operation: 'insert' },
          value: { id: 'invalid-uuid', label: 'Invalid' },
        },
      ]),
    ).rejects.toThrow();
    expect((await database.query('select * from person')).rows).toEqual([]);
    expect((await readLocalFirstTableStates(database))[0]).toMatchObject({
      offset: '-1',
      handle: null,
      complete: false,
    });
  });

  it('should preserve changes to the same record in message order', async () => {
    await apply([
      {
        headers: { operation: 'insert' },
        value: { id: RECORD_ID, label: 'First' },
      },
      {
        headers: { operation: 'insert' },
        value: { id: RECORD_ID, label: 'Second' },
      },
      { headers: { operation: 'delete' }, value: { id: RECORD_ID } },
      {
        headers: { operation: 'insert' },
        value: { id: RECORD_ID, label: 'Final' },
      },
    ]);
    expect((await database.query('select label from person')).rows).toEqual([
      { label: 'Final' },
    ]);
  });

  it('should preserve fields omitted by a partial shape update', async () => {
    await apply([
      {
        headers: { operation: 'insert' },
        value: { id: RECORD_ID, label: 'Example', priority: 3 },
      },
    ]);
    await apply(
      [
        {
          headers: { operation: 'update' },
          value: { id: RECORD_ID, priority: '5' },
        },
      ],
      '2_0',
    );
    expect(
      (await database.query('select label, priority from person')).rows,
    ).toEqual([{ label: 'Example', priority: 5 }]);
  });

  it('should discard stale snapshot rows and readiness when a shape expires', async () => {
    await apply([
      {
        headers: { operation: 'insert' },
        value: { id: RECORD_ID, label: 'Old' },
      },
    ]);
    await resetLocalFirstTable({ pg: database, tableName: 'person' });
    expect((await database.query('select * from person')).rows).toEqual([]);
    expect((await readLocalFirstTableStates(database))[0]).toMatchObject({
      offset: '-1',
      handle: null,
      complete: false,
    });
  });

  it('should preserve a completed snapshot when its schema is unchanged', async () => {
    await apply([
      {
        headers: { operation: 'insert' },
        value: { id: RECORD_ID, label: 'Example' },
      },
    ]);
    await ensureLocalFirstReplicaSchema({
      pg: database,
      tableName: 'person',
      columns: COLUMNS,
    });
    expect((await database.query('select label from person')).rows).toEqual([
      { label: 'Example' },
    ]);
    expect((await readLocalFirstTableStates(database))[0].complete).toBe(true);
  });

  it('should invalidate a snapshot when a custom field is added and allow the new shape to sync', async () => {
    await apply([
      {
        headers: { operation: 'insert' },
        value: { id: RECORD_ID, label: 'Example' },
      },
    ]);
    const columns = [...COLUMNS, { name: 'customStatus', dataType: 'text' }];
    await ensureLocalFirstReplicaSchema({
      pg: database,
      tableName: 'person',
      columns,
    });
    expect((await readLocalFirstTableStates(database))[0]).toMatchObject({
      columns,
      complete: false,
      offset: '-1',
    });
    await applyLocalFirstShapeBatch({
      pg: database,
      tableName: 'person',
      columns,
      batch: {
        messages: [
          {
            headers: { operation: 'insert' },
            value: { id: RECORD_ID, label: 'Example', customStatus: 'Ready' },
          },
        ],
        offset: '2_0',
        handle: 'shape-2',
        complete: true,
      },
    });
    expect(
      (await database.query('select "customStatus" from person')).rows,
    ).toEqual([{ customStatus: 'Ready' }]);
  });

  it('should retain the previous schema and data when a replacement schema is invalid', async () => {
    await apply([
      {
        headers: { operation: 'insert' },
        value: { id: RECORD_ID, label: 'Example' },
      },
    ]);
    await expect(
      ensureLocalFirstReplicaSchema({
        pg: database,
        tableName: 'person',
        columns: [...COLUMNS, COLUMNS[0]],
      }),
    ).rejects.toThrow();
    expect((await database.query('select label from person')).rows).toEqual([
      { label: 'Example' },
    ]);
    expect((await readLocalFirstTableStates(database))[0]).toMatchObject({
      columns: COLUMNS,
      complete: true,
    });
  });
});
