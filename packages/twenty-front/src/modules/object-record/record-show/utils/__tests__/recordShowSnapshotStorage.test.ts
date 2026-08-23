import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import {
  clearRecordShowSnapshots,
  readRecordShowSnapshot,
  RECORD_SHOW_SNAPSHOTS_STORAGE_KEY,
  removeRecordShowSnapshot,
  saveRecordShowSnapshot,
} from '@/object-record/record-show/utils/recordShowSnapshotStorage';

const buildRecord = (id: string): ObjectRecord =>
  ({
    id,
    __typename: 'Person',
    name: { firstName: 'Ada', lastName: 'Lovelace' },
    jobTitle: 'Engineer',
    company: { id: 'company-1', name: 'Acme' },
    noteTargets: [{ id: 'note-target-1' }],
    taskTargets: [],
  }) as unknown as ObjectRecord;

describe('recordShowSnapshotStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return the saved record without to-many array fields', () => {
    saveRecordShowSnapshot(buildRecord('record-1'));

    const snapshot = readRecordShowSnapshot('record-1');

    expect(snapshot).toMatchObject({
      id: 'record-1',
      jobTitle: 'Engineer',
      name: { firstName: 'Ada', lastName: 'Lovelace' },
      company: { id: 'company-1', name: 'Acme' },
    });
    expect(snapshot).not.toHaveProperty('noteTargets');
    expect(snapshot).not.toHaveProperty('taskTargets');
  });

  it('should return null when no snapshot exists', () => {
    expect(readRecordShowSnapshot('missing')).toBeNull();
  });

  it('should evict the least recently saved record beyond the cap', () => {
    for (let index = 0; index < 55; index++) {
      saveRecordShowSnapshot(buildRecord(`record-${index}`));
    }

    expect(readRecordShowSnapshot('record-0')).toBeNull();
    expect(readRecordShowSnapshot('record-4')).toBeNull();
    expect(readRecordShowSnapshot('record-5')).not.toBeNull();
    expect(readRecordShowSnapshot('record-54')).not.toBeNull();
  });

  it('should refresh recency when a record is saved again', () => {
    saveRecordShowSnapshot(buildRecord('record-old'));
    for (let index = 0; index < 49; index++) {
      saveRecordShowSnapshot(buildRecord(`record-${index}`));
    }
    saveRecordShowSnapshot(buildRecord('record-old'));
    saveRecordShowSnapshot(buildRecord('record-new'));

    expect(readRecordShowSnapshot('record-old')).not.toBeNull();
    expect(readRecordShowSnapshot('record-0')).toBeNull();
  });

  it('should remove a single snapshot', () => {
    saveRecordShowSnapshot(buildRecord('record-1'));
    removeRecordShowSnapshot('record-1');

    expect(readRecordShowSnapshot('record-1')).toBeNull();
  });

  it('should clear all snapshots', () => {
    saveRecordShowSnapshot(buildRecord('record-1'));
    clearRecordShowSnapshots();

    expect(localStorage.getItem(RECORD_SHOW_SNAPSHOTS_STORAGE_KEY)).toBeNull();
    expect(readRecordShowSnapshot('record-1')).toBeNull();
  });

  it('should tolerate corrupted stored JSON', () => {
    localStorage.setItem(RECORD_SHOW_SNAPSHOTS_STORAGE_KEY, '{not json');

    expect(readRecordShowSnapshot('record-1')).toBeNull();

    saveRecordShowSnapshot(buildRecord('record-1'));
    expect(readRecordShowSnapshot('record-1')).not.toBeNull();
  });
});
