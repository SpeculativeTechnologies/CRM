import { z } from 'zod';

const identifier = z.uuid();
const label = z.string().trim().min(1).max(200);
const value = z.union([
  z.string().max(100_000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const personalToolSchema = z
  .strictObject({
    id: identifier,
    title: label,
    fields: z
      .array(
        z.strictObject({
          id: identifier,
          label,
          type: z.enum(['text', 'number', 'checkbox']),
          archived: z.boolean(),
        }),
      )
      .min(1)
      .max(100),
    views: z
      .array(
        z.strictObject({
          id: identifier,
          name: label,
          columns: z.array(identifier).max(100),
          filter: z
            .strictObject({ fieldId: identifier, value: z.string().max(1000) })
            .nullable(),
          sort: z
            .strictObject({
              fieldId: identifier,
              direction: z.enum(['ascending', 'descending']),
            })
            .nullable(),
        }),
      )
      .min(1)
      .max(30),
    records: z
      .array(
        z.strictObject({
          id: identifier,
          values: z.record(identifier, value),
          source: z
            .strictObject({
              objectId: identifier,
              recordId: identifier,
              objectName: label,
            })
            .optional(),
        }),
      )
      .max(5000),
  })
  .superRefine((tool, context) => {
    const fail = (message: string) =>
      context.addIssue({ code: 'custom', message });
    for (const items of [tool.fields, tool.views, tool.records]) {
      if (new Set(items.map((item) => item.id)).size !== items.length)
        fail('IDs must be unique within a collection');
    }
    const fields = new Map(tool.fields.map((field) => [field.id, field]));
    for (const view of tool.views) {
      if (new Set(view.columns).size !== view.columns.length)
        fail('A view cannot repeat a column');
      for (const fieldId of [
        ...view.columns,
        ...(view.filter ? [view.filter.fieldId] : []),
        ...(view.sort ? [view.sort.fieldId] : []),
      ]) {
        if (!fields.has(fieldId)) fail('A view references an unknown field');
      }
    }
    for (const record of tool.records) {
      for (const [fieldId, fieldValue] of Object.entries(record.values)) {
        const field = fields.get(fieldId);
        if (!field) fail('A record references an unknown field');
        else if (
          fieldValue !== null &&
          typeof fieldValue !==
            { text: 'string', number: 'number', checkbox: 'boolean' }[
              field.type
            ]
        )
          fail('A value does not match its field type');
      }
    }
  });

export type PersonalTool = z.infer<typeof personalToolSchema>;
export type PersonalToolField = PersonalTool['fields'][number];
export type PersonalToolView = PersonalTool['views'][number];
export type PersonalToolRevision = {
  revision: number;
  definition: PersonalTool;
  createdAt: string;
};

export const personalToolImportSchema = z.object({
  format: z.literal('twenty-personal-tool'),
  version: z.literal(1),
  definition: personalToolSchema,
});
