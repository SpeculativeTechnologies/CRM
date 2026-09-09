import { type LocalFirstJournalEntry } from '@/local-first/types/LocalFirstJournalEntry';
import { getObjectTypename } from '@/object-record/cache/utils/getObjectTypename';

export const overlayLocalFirstChanges = (
  value: unknown,
  entries: LocalFirstJournalEntry[],
): unknown => {
  if (Array.isArray(value))
    return value.map((item) => overlayLocalFirstChanges(item, entries));
  if (value === null || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = Object.fromEntries(
    Object.entries(record).map(([key, child]) => [
      key,
      overlayLocalFirstChanges(child, entries),
    ]),
  );
  for (const entry of entries) {
    if (
      entry.operation.recordId !== record.id ||
      getObjectTypename(entry.objectName) !== record.__typename ||
      ['applied', 'superseded'].includes(entry.state)
    )
      continue;
    for (const change of entry.operation.changes) {
      const name = entry.fieldNames[change.fieldId];
      if (Object.hasOwn(result, name)) result[name] = change.after;
    }
  }
  return result;
};
