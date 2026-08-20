import { recordTableCellRangeComponentState } from '@/object-record/record-table/record-table-cell-range/states/recordTableCellRangeComponentState';
import { type RecordTableAxisBounds } from '@/object-record/record-table/record-table-cell-range/types/RecordTableAxisBound';
import { computeRecordTableCellRangeFromSelectionBox } from '@/object-record/record-table/record-table-cell-range/utils/computeRecordTableCellRangeFromSelectionBox';
import { getRecordTableAxisBounds } from '@/object-record/record-table/record-table-cell-range/utils/getRecordTableAxisBounds';
import { type SelectionBox } from '@/ui/utilities/drag-select/types/SelectionBox';
import { useAtomComponentStateCallbackState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateCallbackState';
import { useStore } from 'jotai';
import { useCallback, useRef, type RefObject } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { isDeeplyEqual } from '~/utils/isDeeplyEqual';

export const useUpdateRecordTableCellRangeFromSelectionBox = ({
  containerRef,
  recordTableId,
}: {
  containerRef: RefObject<HTMLElement | null>;
  recordTableId: string;
}) => {
  const recordTableCellRange = useAtomComponentStateCallbackState(
    recordTableCellRangeComponentState,
    recordTableId,
  );

  // Cell geometry is measured against the container, so it does not move while
  // the table scrolls under the drag. Measuring once per drag keeps the move
  // handler off the layout path instead of reading every row and column rect on
  // each mouse move.
  // oxlint-disable-next-line twenty/no-state-useref -- A measurement cache, not state: nothing renders from it and it is dropped at the end of each drag.
  const axisBoundsRef = useRef<RecordTableAxisBounds | null>(null);

  const store = useStore();

  const resetRecordTableAxisBounds = useCallback(() => {
    axisBoundsRef.current = null;
  }, []);

  const updateRecordTableCellRangeFromSelectionBox = useCallback(
    (selectionBox: SelectionBox | null) => {
      const container = containerRef.current;

      if (!isDefined(selectionBox) || !isDefined(container)) {
        return;
      }

      const axisBounds =
        axisBoundsRef.current ?? getRecordTableAxisBounds(container);

      axisBoundsRef.current = axisBounds;

      const newCellRange = computeRecordTableCellRangeFromSelectionBox({
        selectionBox,
        rowBounds: axisBounds.rowBounds,
        columnBounds: axisBounds.columnBounds,
      });

      // Dragging inside one cell fires many moves that all resolve to the same
      // range, and writing it again would re-render every cell each time.
      if (isDeeplyEqual(newCellRange, store.get(recordTableCellRange))) {
        return;
      }

      store.set(recordTableCellRange, newCellRange);
    },
    [containerRef, recordTableCellRange, store],
  );

  return {
    updateRecordTableCellRangeFromSelectionBox,
    resetRecordTableAxisBounds,
  };
};
