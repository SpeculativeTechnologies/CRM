import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { useRecordShowPageRecordGqlFields } from '@/object-record/record-show/hooks/useRecordShowPageRecordGqlFields';
import {
  readRecordShowSnapshot,
  removeRecordShowSnapshot,
  saveRecordShowSnapshot,
} from '@/object-record/record-show/utils/recordShowSnapshotStorage';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useStore } from 'jotai';
import { useCallback, useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

type RecordShowEffectProps = {
  objectNameSingular: string;
  recordId: string;
};

export const RecordShowEffect = ({
  objectNameSingular,
  recordId,
}: RecordShowEffectProps) => {
  const { recordGqlFields } = useRecordShowPageRecordGqlFields({
    objectNameSingular,
  });

  const store = useStore();

  const { record, loading } = useFindOneRecord({
    objectRecordId: recordId,
    objectNameSingular,
    recordGqlFields,
    withSoftDeleted: true,
  });

  const setRecordStore = useCallback(
    async (newRecord: ObjectRecord | null | undefined) => {
      const previousRecordValue = store.get(
        recordStoreFamilyState.atomFamily(recordId),
      );

      if (JSON.stringify(previousRecordValue) !== JSON.stringify(newRecord)) {
        store.set(recordStoreFamilyState.atomFamily(recordId), newRecord);
      }
    },
    [recordId, store],
  );

  // Paint immediately from the locally persisted snapshot of a previously
  // visited record; the findOne result overwrites it as soon as it lands.
  const [hasSeededFromSnapshot, setHasSeededFromSnapshot] = useState(false);

  useEffect(() => {
    if (hasSeededFromSnapshot) {
      return;
    }
    setHasSeededFromSnapshot(true);

    const existingRecord = store.get(
      recordStoreFamilyState.atomFamily(recordId),
    );
    if (isDefined(existingRecord)) {
      return;
    }

    const snapshot = readRecordShowSnapshot(recordId);
    if (isDefined(snapshot)) {
      store.set(recordStoreFamilyState.atomFamily(recordId), snapshot);
    }
  }, [hasSeededFromSnapshot, recordId, store]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (isDefined(record)) {
      setRecordStore(record);
      saveRecordShowSnapshot(record);
      return;
    }

    // The record no longer exists (or is not readable): a stale snapshot
    // must not keep painting it, and its cache entry has to go.
    if (hasSeededFromSnapshot) {
      removeRecordShowSnapshot(recordId);
      setRecordStore(undefined);
    }
  }, [record, setRecordStore, loading, hasSeededFromSnapshot, recordId]);

  return <></>;
};
