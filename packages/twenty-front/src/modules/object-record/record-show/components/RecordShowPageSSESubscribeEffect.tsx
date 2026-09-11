import { useListenToEventsForQuery } from '@/sse-db-event/hooks/useListenToEventsForQuery';
import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { useCallback } from 'react';
import { useWorkspaceSurfaceScopedComponentInstanceId } from '@/ui/layout/hooks/useWorkspaceSurfaceScopedComponentInstanceId';

type RecordShowPageSSESubscribeEffectProps = {
  objectNameSingular: string;
  recordId: string;
};

export const RecordShowPageSSESubscribeEffect = ({
  objectNameSingular,
  recordId,
}: RecordShowPageSSESubscribeEffectProps) => {
  const { refetch } = useFindOneRecord({
    objectNameSingular,
    objectRecordId: recordId,
  });
  const reloadRecord = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const queryId = useWorkspaceSurfaceScopedComponentInstanceId(
    `record-show-${objectNameSingular}-${recordId}`,
  );

  useListenToEventsForQuery({
    queryId,
    onSseReconnected: reloadRecord,
    operationSignature: {
      objectNameSingular,
      variables: {
        filter: { id: { eq: recordId } },
        limit: 1,
      },
    },
  });

  return null;
};
