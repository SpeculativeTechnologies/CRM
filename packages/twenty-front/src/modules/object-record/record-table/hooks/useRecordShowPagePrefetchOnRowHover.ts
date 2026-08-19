import { usePrefetchRecordShowPageRecord } from '@/object-record/record-show/hooks/usePrefetchRecordShowPageRecord';
import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { useCallback } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { useDebouncedCallback } from 'use-debounce';

// Long enough to skip rows crossed while scanning the table, short enough to
// hide most of the findOne round trip before the user clicks through.
const ROW_HOVER_PREFETCH_DELAY_MS = 150;

export const useRecordShowPagePrefetchOnRowHover = () => {
  const { objectMetadataItem } = useRecordTableContextOrThrow();

  const { prefetchRecordShowPageRecord } = usePrefetchRecordShowPageRecord({
    objectNameSingular: objectMetadataItem.nameSingular,
  });

  const prefetchHoveredRecordDebounced = useDebouncedCallback(
    (hoveredRecordId: string) => {
      prefetchRecordShowPageRecord(hoveredRecordId);
    },
    ROW_HOVER_PREFETCH_DELAY_MS,
  );

  const cancelPendingRowHoverPrefetch = useCallback(() => {
    prefetchHoveredRecordDebounced.cancel();
  }, [prefetchHoveredRecordDebounced]);

  const handleRowHoverPrefetch = useCallback(
    (event: React.MouseEvent) => {
      const rowElement = (event.target as HTMLElement).closest<HTMLElement>(
        '[data-selectable-id]',
      );

      const hoveredRecordId = rowElement?.dataset.selectableId;

      if (!isDefined(hoveredRecordId)) {
        prefetchHoveredRecordDebounced.cancel();
        return;
      }

      prefetchHoveredRecordDebounced(hoveredRecordId);
    },
    [prefetchHoveredRecordDebounced],
  );

  return { handleRowHoverPrefetch, cancelPendingRowHoverPrefetch };
};
