import { useIsLogged } from '@/auth/hooks/useIsLogged';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { usePrefetchRecordShowPageRecord } from '@/object-record/record-show/hooks/usePrefetchRecordShowPageRecord';
import { useEffect, useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

const EarlyRecordShowPrefetchRunnerEffect = ({
  objectNameSingular,
  objectRecordId,
}: {
  objectNameSingular: string;
  objectRecordId: string;
}) => {
  const { prefetchRecordShowPageRecord } = usePrefetchRecordShowPageRecord({
    objectNameSingular,
  });

  const [hasPrefetched, setHasPrefetched] = useState(false);

  useEffect(() => {
    if (hasPrefetched) {
      return;
    }

    setHasPrefetched(true);
    prefetchRecordShowPageRecord(objectRecordId);
  }, [hasPrefetched, prefetchRecordShowPageRecord, objectRecordId]);

  return null;
};

// On a direct record URL load, the show page cannot issue its findOne until
// the auth and metadata gates have opened and its lazy chunk has loaded.
// When the metadata store is already hydrated from IndexedDB (any returning
// visitor), the exact show page query can be built and fired as soon as the
// Apollo client exists, so it resolves in parallel with the boot queries and
// the page paints from cache the moment the gates open. Only the initial
// location is prefetched — in-app navigation is covered by the row hover
// prefetch.
export const EarlyRecordShowPrefetch = () => {
  const { pathname } = useLocation();
  const isLogged = useIsLogged();

  const [initialMatch] = useState(() =>
    matchPath(AppPath.RecordShowPage, pathname),
  );

  const objectNameSingular = initialMatch?.params.objectNameSingular;
  const objectRecordId = initialMatch?.params.objectRecordId;

  const { objectMetadataItems } = useObjectMetadataItems();

  const objectMetadataIsAvailable = objectMetadataItems.some(
    (objectMetadataItem) =>
      objectMetadataItem.nameSingular === objectNameSingular,
  );

  if (
    !isLogged ||
    !isDefined(objectNameSingular) ||
    !isDefined(objectRecordId) ||
    !objectMetadataIsAvailable
  ) {
    return null;
  }

  return (
    <EarlyRecordShowPrefetchRunnerEffect
      objectNameSingular={objectNameSingular}
      objectRecordId={objectRecordId}
    />
  );
};
