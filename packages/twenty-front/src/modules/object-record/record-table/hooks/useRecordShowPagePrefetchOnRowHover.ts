import { usePrefetchRecordShowPageRecord } from '@/object-record/record-show/hooks/usePrefetchRecordShowPageRecord';
import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { useCallback, useEffect, useRef } from 'react';
import { isDefined } from 'twenty-shared/utils';

// Long enough to skip rows crossed while scanning the table, short enough to
// hide most of the findOne round trip before the user clicks through.
const ROW_HOVER_PREFETCH_DELAY_MS = 150;

export const useRecordShowPagePrefetchOnRowHover = () => {
  const { objectMetadataItem } = useRecordTableContextOrThrow();

  const { prefetchRecordShowPageRecord } = usePrefetchRecordShowPageRecord({
    objectNameSingular: objectMetadataItem.nameSingular,
  });

  const hoverIntentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastHoveredRecordIdRef = useRef<string | null>(null);

  const cancelPendingRowHoverPrefetch = useCallback(() => {
    lastHoveredRecordIdRef.current = null;

    if (isDefined(hoverIntentTimeoutRef.current)) {
      clearTimeout(hoverIntentTimeoutRef.current);
      hoverIntentTimeoutRef.current = null;
    }
  }, []);

  const handleRowHoverPrefetch = useCallback(
    (event: React.MouseEvent) => {
      const rowElement = (event.target as HTMLElement).closest<HTMLElement>(
        '[data-selectable-id]',
      );

      const hoveredRecordId = rowElement?.dataset.selectableId ?? null;

      if (hoveredRecordId === lastHoveredRecordIdRef.current) {
        return;
      }

      lastHoveredRecordIdRef.current = hoveredRecordId;

      if (isDefined(hoverIntentTimeoutRef.current)) {
        clearTimeout(hoverIntentTimeoutRef.current);
        hoverIntentTimeoutRef.current = null;
      }

      if (!isDefined(hoveredRecordId)) {
        return;
      }

      hoverIntentTimeoutRef.current = setTimeout(() => {
        hoverIntentTimeoutRef.current = null;
        prefetchRecordShowPageRecord(hoveredRecordId);
      }, ROW_HOVER_PREFETCH_DELAY_MS);
    },
    [prefetchRecordShowPageRecord],
  );

  useEffect(
    () => () => {
      if (isDefined(hoverIntentTimeoutRef.current)) {
        clearTimeout(hoverIntentTimeoutRef.current);
      }
    },
    [],
  );

  return { handleRowHoverPrefetch, cancelPendingRowHoverPrefetch };
};
