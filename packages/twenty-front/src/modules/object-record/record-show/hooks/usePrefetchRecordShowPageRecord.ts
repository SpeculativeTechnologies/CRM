import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useFindOneRecordQuery } from '@/object-record/hooks/useFindOneRecordQuery';
import { useObjectPermissionsForObject } from '@/object-record/hooks/useObjectPermissionsForObject';
import { useRecordShowPageRecordGqlFields } from '@/object-record/record-show/hooks/useRecordShowPageRecordGqlFields';
import { useCallback, useRef } from 'react';

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

  const prefetchedRecordIdsRef = useRef(new Set<string>());

  const prefetchRecordShowPageRecord = useCallback(
    (objectRecordId: string) => {
      if (
        !hasReadPermission ||
        prefetchedRecordIdsRef.current.has(objectRecordId)
      ) {
        return;
      }

      prefetchedRecordIdsRef.current.add(objectRecordId);

      apolloCoreClient
        .query({
          query: findOneRecordQuery,
          variables: { objectRecordId },
          fetchPolicy: 'cache-first',
        })
        .catch(() => {
          // Allow a later hover to retry after a transient failure.
          prefetchedRecordIdsRef.current.delete(objectRecordId);
        });
    },
    [hasReadPermission, apolloCoreClient, findOneRecordQuery],
  );

  return { prefetchRecordShowPageRecord };
};
