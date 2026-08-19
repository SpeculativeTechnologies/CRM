import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useFindOneRecordQuery } from '@/object-record/hooks/useFindOneRecordQuery';
import { useObjectPermissionsForObject } from '@/object-record/hooks/useObjectPermissionsForObject';
import { useRecordShowPageRecordGqlFields } from '@/object-record/record-show/hooks/useRecordShowPageRecordGqlFields';
import { useCallback } from 'react';

// Warms the Apollo cache with the exact findOne query the record show page
// runs, so navigating to the record paints instantly from cache while
// cache-and-network revalidates in the background.
export const usePrefetchRecordShowPageRecord = ({
  objectNameSingular,
}: {
  objectNameSingular: string;
}) => {
  const { objectMetadataItem } = useObjectMetadataItem({ objectNameSingular });

  const { recordGqlFields } = useRecordShowPageRecordGqlFields({
    objectNameSingular,
  });

  const { findOneRecordQuery } = useFindOneRecordQuery({
    objectNameSingular,
    recordGqlFields,
    withSoftDeleted: true,
  });

  const apolloCoreClient = useApolloCoreClient();

  const objectPermissions = useObjectPermissionsForObject(
    objectMetadataItem.id,
  );

  const hasReadPermission = objectPermissions.canReadObjectRecords;

  const prefetchRecordShowPageRecord = useCallback(
    (objectRecordId: string) => {
      if (!hasReadPermission) {
        return;
      }

      // cache-first skips the network once the record is already complete in
      // the cache, and Apollo deduplicates concurrent identical operations,
      // so repeated hovers cost at most a cache read.
      apolloCoreClient
        .query({
          query: findOneRecordQuery,
          variables: { objectRecordId },
          fetchPolicy: 'cache-first',
        })
        .catch(() => {});
    },
    [hasReadPermission, apolloCoreClient, findOneRecordQuery],
  );

  return { prefetchRecordShowPageRecord };
};
