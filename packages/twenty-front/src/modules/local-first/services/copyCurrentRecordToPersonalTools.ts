import { FieldMetadataType } from 'twenty-shared/types';

import {
  assertLocalFirstScopeIsCurrent,
  getCurrentLocalFirstScope,
} from '@/local-first/services/getCurrentLocalFirstScope';
import { getLocalFirstDatabase } from '@/local-first/services/getLocalFirstDatabase';
import {
  createPersonalTool,
  initializePersonalTools,
  savePersonalTool,
} from '@/local-first/services/personalToolStorage';
import { type PersonalToolField } from '@/local-first/types/PersonalTool';
import { objectMetadataItemsWithFieldsSelector } from '@/object-metadata/states/objectMetadataItemsWithFieldsSelector';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';

export const copyCurrentRecordToPersonalTools = async () => {
  const scope = getCurrentLocalFirstScope();
  const match = window.location.pathname.match(
    /^\/object\/([^/]+)\/([0-9a-f-]{36})$/i,
  );
  if (!scope || !match) throw new Error('Open a CRM record before copying it');
  const object = jotaiStore
    .get(objectMetadataItemsWithFieldsSelector.atom)
    .find((candidate) => candidate.nameSingular === match[1]);
  const record = jotaiStore.get(recordStoreFamilyState.atomFamily(match[2]));
  if (!object || !record)
    throw new Error('Wait for this record to load before copying it');
  const fields: PersonalToolField[] = [];
  const values: Record<string, string | number | boolean | null> = {};
  for (const field of object.readableFields) {
    if (!field.isActive || field.isSystem) continue;
    const value: unknown = record[field.name];
    let copied: string | number | boolean | null;
    let type: PersonalToolField['type'];
    if (
      field.type === FieldMetadataType.FULL_NAME &&
      value &&
      typeof value === 'object'
    ) {
      const name = value as Record<string, unknown>;
      copied = [name.firstName, name.lastName]
        .filter((part) => typeof part === 'string')
        .join(' ');
      type = 'text';
    } else if (
      (field.type === FieldMetadataType.TEXT ||
        field.type === FieldMetadataType.SELECT) &&
      (typeof value === 'string' || value === null)
    ) {
      copied = value;
      type = 'text';
    } else if (
      field.type === FieldMetadataType.NUMBER &&
      ((typeof value === 'number' && Number.isFinite(value)) || value === null)
    ) {
      copied = value;
      type = 'number';
    } else if (
      field.type === FieldMetadataType.BOOLEAN &&
      (typeof value === 'boolean' || value === null)
    ) {
      copied = value;
      type = 'checkbox';
    } else continue;
    fields.push({ id: field.id, label: field.label, type, archived: false });
    values[field.id] = copied;
  }
  if (fields.length === 0)
    throw new Error(
      'This record has no loaded fields supported by personal tools',
    );
  const tool = createPersonalTool(`${object.labelSingular} — personal copy`);
  tool.fields = fields;
  tool.views[0].columns = fields.slice(0, 6).map((field) => field.id);
  tool.records = [
    {
      id: crypto.randomUUID(),
      values,
      source: {
        objectId: object.id,
        recordId: record.id,
        objectName: object.nameSingular,
      },
    },
  ];
  const database = await getLocalFirstDatabase(scope);
  await initializePersonalTools(database);
  assertLocalFirstScopeIsCurrent(scope);
  await savePersonalTool(database, tool, 0);
  assertLocalFirstScopeIsCurrent(scope);
};
