import {
  FieldMetadataType,
  type LocalFirstFieldChange,
  type LocalFirstValue,
} from 'twenty-shared/types';

import { IS_LOCAL_FIRST_WRITES_ENABLED } from '@/local-first/constants/IS_LOCAL_FIRST_WRITES_ENABLED';
import {
  assertLocalFirstScopeIsCurrent,
  getCurrentLocalFirstScope,
} from '@/local-first/services/getCurrentLocalFirstScope';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';

const SUPPORTED_TYPES = new Set([
  FieldMetadataType.TEXT,
  FieldMetadataType.NUMBER,
  FieldMetadataType.BOOLEAN,
  FieldMetadataType.SELECT,
]);
const isValue = (value: unknown): value is LocalFirstValue =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

export const tryCommitLocalFirstRecordUpdate = async ({
  objectMetadataItem,
  recordId,
  input,
  previous,
}: {
  objectMetadataItem: EnrichedObjectMetadataItem;
  recordId: string;
  input: Record<string, unknown>;
  previous: Record<string, unknown> | null;
}) => {
  if (!IS_LOCAL_FIRST_WRITES_ENABLED) return false;
  const scope = getCurrentLocalFirstScope();
  if (
    !scope ||
    !previous ||
    objectMetadataItem.isSystem ||
    objectMetadataItem.isRemote
  )
    return false;
  const changes: LocalFirstFieldChange[] = [];
  const fieldNames: Record<string, string> = {};
  for (const [name, value] of Object.entries(input)) {
    const field = objectMetadataItem.updatableFields.find(
      (candidate) => candidate.name === name,
    );
    const before = previous[name];
    if (
      !field ||
      field.isSystem ||
      !field.isActive ||
      !SUPPORTED_TYPES.has(field.type) ||
      !isValue(before) ||
      !isValue(value)
    ) {
      return false;
    }
    if (before !== value)
      changes.push({ fieldId: field.id, before, after: value });
    fieldNames[field.id] = name;
  }
  if (changes.length === 0) return true;
  const [
    { getLocalFirstDatabase },
    { initializeLocalFirstJournal, commitLocalFirstChange },
  ] = await Promise.all([
    import('@/local-first/services/getLocalFirstDatabase'),
    import('@/local-first/services/localFirstJournal'),
  ]);
  const database = await getLocalFirstDatabase(scope);
  await initializeLocalFirstJournal(database);
  assertLocalFirstScopeIsCurrent(scope);
  await commitLocalFirstChange({
    database,
    operation: {
      operationId: crypto.randomUUID(),
      objectId: objectMetadataItem.id,
      recordId,
      changes,
    },
    objectName: objectMetadataItem.nameSingular,
    fieldNames,
  });
  assertLocalFirstScopeIsCurrent(scope);
  return true;
};
