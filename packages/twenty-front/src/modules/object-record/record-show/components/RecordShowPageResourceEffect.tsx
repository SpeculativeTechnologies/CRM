import { useEffect, useState } from 'react';

import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import {
  readRecordShowSnapshot,
  removeRecordShowSnapshot,
  saveRecordShowSnapshot,
} from '@/object-record/record-show/utils/recordShowSnapshotStorage';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useStore } from 'jotai';
import { isDefined } from 'twenty-shared/utils';
import { isDeeplyEqual } from '~/utils/isDeeplyEqual';

export const RecordShowPageResourceEffect = ({
  loading,
  record,
  recordId,
}: {
  loading: boolean;
  record: ObjectRecord | undefined;
  recordId: string;
}) => {
  const store = useStore();

  // Paint immediately from the locally persisted snapshot of a previously
  // visited record; the findOne result overwrites it as soon as it lands.
  const [hasSeededFromSnapshot, setHasSeededFromSnapshot] = useState(false);

  useEffect(() => {
    if (hasSeededFromSnapshot) {
      return;
    }
    setHasSeededFromSnapshot(true);

    const recordAtom = recordStoreFamilyState.atomFamily(recordId);

    if (isDefined(store.get(recordAtom))) {
      return;
    }

    const snapshot = readRecordShowSnapshot(recordId);

    if (isDefined(snapshot)) {
      store.set(recordAtom, snapshot);
    }
  }, [hasSeededFromSnapshot, recordId, store]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const recordAtom = recordStoreFamilyState.atomFamily(recordId);
    const previousRecord = store.get(recordAtom);

    if (!isDefined(record)) {
      // The record no longer exists (or is not readable): a stale snapshot
      // must not keep painting it.
      removeRecordShowSnapshot(recordId);

      if (isDefined(previousRecord)) {
        store.set(recordAtom, null);
      }
      return;
    }

    saveRecordShowSnapshot(record);

    if (!isDeeplyEqual(previousRecord, record)) {
      store.set(recordAtom, record);
    }
  }, [loading, record, recordId, store]);

  return null;
};
