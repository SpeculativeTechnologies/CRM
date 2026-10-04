import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { useRecordShowPageRecordGqlFields } from '@/object-record/record-show/hooks/useRecordShowPageRecordGqlFields';

export const useRecordShowPageResource = ({
  objectNameSingular,
  recordId,
  skip,
}: {
  objectNameSingular: string;
  recordId: string;
  skip?: boolean;
}) => {
  const { recordGqlFields } = useRecordShowPageRecordGqlFields({
    objectNameSingular,
  });

  const queryResult = useFindOneRecord({
    objectRecordId: recordId,
    objectNameSingular,
    recordGqlFields,
    withSoftDeleted: true,
    skip,
  });

  return queryResult;
};
