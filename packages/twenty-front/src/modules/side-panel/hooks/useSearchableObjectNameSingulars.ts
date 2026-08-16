import { useMemo } from 'react';

import { useReadableObjectMetadataItems } from '@/object-metadata/hooks/useReadableObjectMetadataItems';
import { sidePanelShowHiddenObjectsState } from '@/side-panel/states/sidePanelShowHiddenObjectsState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export const useSearchableObjectNameSingulars = () => {
  const { readableObjectMetadataItems } = useReadableObjectMetadataItems();
  const sidePanelShowHiddenObjects = useAtomStateValue(
    sidePanelShowHiddenObjectsState,
  );

  return useMemo(() => {
    return readableObjectMetadataItems
      .filter((item) => sidePanelShowHiddenObjects || item.isSearchable)
      .map((item) => item.nameSingular);
  }, [readableObjectMetadataItems, sidePanelShowHiddenObjects]);
};
