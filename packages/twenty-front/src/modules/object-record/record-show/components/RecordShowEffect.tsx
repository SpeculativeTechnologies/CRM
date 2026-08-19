import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { useRecordShowPageRecordGqlFields } from '@/object-record/record-show/hooks/useRecordShowPageRecordGqlFields';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useStore } from 'jotai';
import { useCallback, useEffect } from 'react';
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

  useEffect(() => {
    if (!loading && isDefined(record)) {
      setRecordStore(record);
    }
  }, [record, setRecordStore, loading]);

  return <></>;
};
