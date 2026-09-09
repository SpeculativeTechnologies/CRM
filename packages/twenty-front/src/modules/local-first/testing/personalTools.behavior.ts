import { afterEach, beforeEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'expect';
import { PGlite } from '@electric-sql/pglite';
import { NodeFS } from '@electric-sql/pglite/nodefs';

import {
  createPersonalTool,
  importPersonalTool,
  initializePersonalTools,
  listPersonalTools,
  readPersonalToolHistory,
  savePersonalTool,
} from '@/local-first/services/personalToolStorage';
import { personalToolSchema } from '@/local-first/types/PersonalTool';
import { projectPersonalTool } from '@/local-first/utils/projectPersonalTool';

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

describe('personal tools as durable definitions and records', () => {
  let directory: string;
  let database: PGlite;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'twenty-personal-'));
    database = await openDatabase(directory);
    await initializePersonalTools(database);
  });
  afterEach(async () => {
    await database.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('should reopen editable fields, views and records without a server', async () => {
    const tool = createPersonalTool('Research funders');
    tool.records.push({
      id: crypto.randomUUID(),
      values: { [tool.fields[0].id]: 'Example Foundation' },
    });
    await savePersonalTool(database, tool, 0);
    await database.close();
    database = await openDatabase(directory);
    expect((await listPersonalTools(database))[0].definition).toEqual(tool);
  });

  it('should preserve values through rename, archive and a new restoration revision', async () => {
    const tool = createPersonalTool('Research funders');
    const fieldId = tool.fields[0].id;
    tool.records.push({
      id: crypto.randomUUID(),
      values: { [fieldId]: 'Example' },
    });
    await savePersonalTool(database, tool, 0);
    const renamed = {
      ...tool,
      fields: [{ ...tool.fields[0], label: 'Organization', archived: true }],
    };
    await savePersonalTool(database, renamed, 1);
    const history = await readPersonalToolHistory(database, tool.id);
    await savePersonalTool(database, history[0].definition, 2);
    const restored = await readPersonalToolHistory(database, tool.id);
    expect(restored.map((revision) => revision.revision)).toEqual([1, 2, 3]);
    expect(restored[1].definition.fields[0].archived).toBe(true);
    expect(restored[2].definition.records[0].values[fieldId]).toBe('Example');
  });

  it('should reject a stale tab without overwriting either committed revision', async () => {
    const tool = createPersonalTool('Original');
    await savePersonalTool(database, tool, 0);
    await savePersonalTool(database, { ...tool, title: 'First tab' }, 1);
    await expect(
      savePersonalTool(database, { ...tool, title: 'Stale tab' }, 1),
    ).rejects.toThrow('another tab');
    expect((await listPersonalTools(database))[0].definition.title).toBe(
      'First tab',
    );
    expect(await readPersonalToolHistory(database, tool.id)).toHaveLength(2);
  });

  it('should import a portable copy without overwriting the original or sharing records', async () => {
    const tool = createPersonalTool('Original');
    tool.records.push({
      id: crypto.randomUUID(),
      values: { [tool.fields[0].id]: 'Example' },
    });
    await savePersonalTool(database, tool, 0);
    const imported = await importPersonalTool(
      database,
      JSON.stringify({
        format: 'twenty-personal-tool',
        version: 1,
        definition: tool,
      }),
    );
    expect(imported.definition.id).not.toBe(tool.id);
    expect(imported.definition.records).toEqual(tool.records);
    const template = await importPersonalTool(
      database,
      JSON.stringify({
        format: 'twenty-personal-tool',
        version: 1,
        definition: { ...tool, records: [] },
      }),
    );
    expect(template.definition.records).toEqual([]);
    expect(await listPersonalTools(database)).toHaveLength(3);
  });

  it('should reject invalid imports atomically, including executable definitions and dangling columns', async () => {
    const tool = createPersonalTool('Original');
    for (const definition of [
      { ...tool, script: 'fetch(secret)' },
      {
        ...tool,
        views: [{ ...tool.views[0], columns: [crypto.randomUUID()] }],
      },
      { ...tool, fields: [tool.fields[0], tool.fields[0]] },
    ]) {
      await expect(
        importPersonalTool(
          database,
          JSON.stringify({
            format: 'twenty-personal-tool',
            version: 1,
            definition,
          }),
        ),
      ).rejects.toThrow();
    }
    expect(await listPersonalTools(database)).toHaveLength(0);
  });

  it('should validate typed values before storing a revision', async () => {
    const tool = createPersonalTool('Original');
    tool.records.push({
      id: crypto.randomUUID(),
      values: { [tool.fields[0].id]: 42 },
    });
    expect(personalToolSchema.safeParse(tool).success).toBe(false);
    await expect(savePersonalTool(database, tool, 0)).rejects.toThrow();
    expect(await listPersonalTools(database)).toHaveLength(0);
  });

  it('should interpret independent view filters and numeric sorts without altering rows', () => {
    const tool = createPersonalTool('Original');
    const amountId = crypto.randomUUID();
    const nameId = tool.fields[0].id;
    tool.fields.push({
      id: amountId,
      label: 'Amount',
      type: 'number',
      archived: false,
    });
    tool.records = [10, 2, 5].map((amount) => ({
      id: crypto.randomUUID(),
      values: {
        [nameId]: amount === 5 ? 'Hidden' : 'Visible',
        [amountId]: amount,
      },
    }));
    const filtered = {
      ...tool.views[0],
      filter: { fieldId: nameId, value: 'VISIBLE' },
      sort: { fieldId: amountId, direction: 'ascending' as const },
    };
    expect(
      projectPersonalTool(tool, filtered).map(
        (record) => record.values[amountId],
      ),
    ).toEqual([2, 10]);
    expect(
      projectPersonalTool(tool, tool.views[0]).map(
        (record) => record.values[amountId],
      ),
    ).toEqual([10, 2, 5]);
  });
});
