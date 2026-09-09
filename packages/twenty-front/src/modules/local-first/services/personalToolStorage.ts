import { type PGliteInterface } from '@electric-sql/pglite';

import {
  personalToolImportSchema,
  personalToolSchema,
  type PersonalTool,
  type PersonalToolRevision,
} from '@/local-first/types/PersonalTool';

type Connection = Pick<PGliteInterface, 'query' | 'exec'>;

export const initializePersonalTools = async (database: Connection) => {
  await database.exec(`
    create schema if not exists local_first;
    create table if not exists local_first.tool_revisions (
      "toolId" uuid not null, revision integer not null,
      definition jsonb not null, "createdAt" timestamptz not null default now(),
      primary key ("toolId", revision)
    );
  `);
};

export const listPersonalTools = async (database: Connection) =>
  (
    await database.query<PersonalToolRevision>(
      `select distinct on ("toolId") revision, definition, "createdAt"
     from local_first.tool_revisions order by "toolId", revision desc`,
    )
  ).rows;

export const readPersonalToolHistory = async (
  database: Connection,
  toolId: string,
) =>
  (
    await database.query<PersonalToolRevision>(
      `select revision, definition, "createdAt" from local_first.tool_revisions
     where "toolId" = $1 order by revision`,
      [toolId],
    )
  ).rows;

// Revisions contain both definitions and rows. Renaming or archiving a field
// cannot lose its values, and restoring history makes a new revision.
export const savePersonalTool = async (
  database: PGliteInterface,
  definition: PersonalTool,
  expectedRevision: number,
) => {
  const parsed = personalToolSchema.parse(definition);
  return database.transaction(async (transaction) => {
    const latest =
      (
        await transaction.query<{ revision: number }>(
          `select revision from local_first.tool_revisions where "toolId" = $1 order by revision desc limit 1`,
          [parsed.id],
        )
      ).rows.at(0)?.revision ?? 0;
    if (latest !== expectedRevision)
      throw new Error(
        'This tool changed in another tab. Reload from this device before saving.',
      );
    return (
      await transaction.query<PersonalToolRevision>(
        `insert into local_first.tool_revisions ("toolId", revision, definition)
       values ($1, $2, $3) returning revision, definition, "createdAt"`,
        [parsed.id, latest + 1, JSON.stringify(parsed)],
      )
    ).rows[0];
  });
};

export const createPersonalTool = (title: string): PersonalTool => {
  const fieldId = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    title,
    fields: [{ id: fieldId, label: 'Name', type: 'text', archived: false }],
    views: [
      {
        id: crypto.randomUUID(),
        name: 'All records',
        columns: [fieldId],
        filter: null,
        sort: null,
      },
    ],
    records: [],
  };
};

export const importPersonalTool = async (
  database: PGliteInterface,
  source: string,
) => {
  if (source.length > 10_000_000)
    throw new Error('This file exceeds the 10 MB import limit');
  const { definition } = personalToolImportSchema.parse(JSON.parse(source));
  // Importing always creates a personal copy, never overwrites an existing tool
  // or publishes the passive source references back to the shared CRM.
  return savePersonalTool(
    database,
    { ...definition, id: crypto.randomUUID() },
    0,
  );
};
