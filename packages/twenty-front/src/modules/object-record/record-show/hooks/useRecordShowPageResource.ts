import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { useRecordShowPageRecordGqlFields } from '@/object-record/record-show/hooks/useRecordShowPageRecordGqlFields';

export const useRecordShowPageResource = ({
  objectNameSingular,
  recordId,
}: {
  objectNameSingular: string;
  recordId: string;
}) => {
  const { recordGqlFields } = useRecordShowPageRecordGqlFields({
    objectNameSingular,
  });

  const queryResult = useFindOneRecord({
    objectRecordId: recordId,
    objectNameSingular,
    recordGqlFields,
    withSoftDeleted: true,
  });

  return queryResult;
};
