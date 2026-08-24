import { useIsLogged } from '@/auth/hooks/useIsLogged';
import { metadataStoreState } from '@/metadata-store/states/metadataStoreState';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { usePrefetchRecordShowPageRecord } from '@/object-record/record-show/hooks/usePrefetchRecordShowPageRecord';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';
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

  // Without page layouts the field set cannot be restricted and the prefetch
  // would issue the expensive full-depth query, which the show page then
  // repeats with the restricted set once layouts land. On a cold boot the
  // layouts arrive with the core metadata wave moments later; waiting for
  // them keeps the prefetch byte-identical to the page query. An up-to-date
  // but empty collection means the workspace genuinely has no layouts, and
  // the unrestricted query is what the page will run anyway.
  const metadataStorePageLayouts = useAtomFamilyStateValue(
    metadataStoreState,
    'pageLayouts',
  );
  const pageLayoutsAreUsable =
    metadataStorePageLayouts.current.length > 0 ||
    metadataStorePageLayouts.status === 'up-to-date';

  if (
    !isLogged ||
    !isDefined(objectNameSingular) ||
    !isDefined(objectRecordId) ||
    !objectMetadataIsAvailable ||
    !pageLayoutsAreUsable
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
