import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { isDefined } from 'twenty-shared/utils';

// Slim local snapshots of recently viewed records so a record show page can
// paint its title and field values immediately on mount, before the findOne
// query returns. To-many relation fields (arrays) are stripped: they can be
// large and their widgets run their own queries anyway.
export const RECORD_SHOW_SNAPSHOTS_STORAGE_KEY = 'recordShowSnapshots';

const MAX_SNAPSHOT_COUNT = 50;

type RecordShowSnapshots = {
  order: string[];
  records: Record<string, ObjectRecord>;
};

const readAll = (): RecordShowSnapshots => {
  try {
    const raw = localStorage.getItem(RECORD_SHOW_SNAPSHOTS_STORAGE_KEY);
    if (!isDefined(raw)) {
      return { order: [], records: {} };
    }
    const parsed = JSON.parse(raw) as RecordShowSnapshots;
    if (!Array.isArray(parsed.order) || typeof parsed.records !== 'object') {
      return { order: [], records: {} };
    }
    return parsed;
  } catch {
    return { order: [], records: {} };
  }
};

const writeAll = (snapshots: RecordShowSnapshots) => {
  try {
    localStorage.setItem(
      RECORD_SHOW_SNAPSHOTS_STORAGE_KEY,
      JSON.stringify(snapshots),
    );
  } catch {
    // Quota or serialization failure: drop the cache rather than break paint.
    try {
      localStorage.removeItem(RECORD_SHOW_SNAPSHOTS_STORAGE_KEY);
    } catch {
      // localStorage unavailable entirely; snapshots are best-effort.
    }
  }
};

const stripToManyFields = (record: ObjectRecord): ObjectRecord => {
  const slim: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      continue;
    }
    slim[key] = value;
  }
  return slim as ObjectRecord;
};

export const readRecordShowSnapshot = (
  recordId: string,
): ObjectRecord | null => {
  const { records } = readAll();
  return records[recordId] ?? null;
};

export const saveRecordShowSnapshot = (record: ObjectRecord) => {
  if (!isDefined(record.id)) {
    return;
  }
  const snapshots = readAll();
  snapshots.records[record.id] = stripToManyFields(record);
  snapshots.order = [
    record.id,
    ...snapshots.order.filter((id) => id !== record.id),
  ];
  while (snapshots.order.length > MAX_SNAPSHOT_COUNT) {
    const evictedId = snapshots.order.pop();
    if (isDefined(evictedId)) {
      delete snapshots.records[evictedId];
    }
  }
  writeAll(snapshots);
};

export const removeRecordShowSnapshot = (recordId: string) => {
  const snapshots = readAll();
  if (!isDefined(snapshots.records[recordId])) {
    return;
  }
  delete snapshots.records[recordId];
  snapshots.order = snapshots.order.filter((id) => id !== recordId);
  writeAll(snapshots);
};

export const clearRecordShowSnapshots = () => {
  try {
    localStorage.removeItem(RECORD_SHOW_SNAPSHOTS_STORAGE_KEY);
  } catch {
    // localStorage unavailable; nothing to clear.
  }
};
