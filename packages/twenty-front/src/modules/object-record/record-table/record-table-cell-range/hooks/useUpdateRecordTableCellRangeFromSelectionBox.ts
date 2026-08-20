import { recordTableCellRangeComponentState } from '@/object-record/record-table/record-table-cell-range/states/recordTableCellRangeComponentState';
import { computeRecordTableCellRangeFromSelectionBox } from '@/object-record/record-table/record-table-cell-range/utils/computeRecordTableCellRangeFromSelectionBox';
import { getRecordTableAxisBounds } from '@/object-record/record-table/record-table-cell-range/utils/getRecordTableAxisBounds';
import { type SelectionBox } from '@/ui/utilities/drag-select/types/SelectionBox';
import { useAtomComponentStateCallbackState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateCallbackState';
import { useStore } from 'jotai';
import { useCallback, type RefObject } from 'react';
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

  const store = useStore();

  const updateRecordTableCellRangeFromSelectionBox = useCallback(
    (selectionBox: SelectionBox | null) => {
      const container = containerRef.current;

      if (!isDefined(selectionBox) || !isDefined(container)) {
        return;
      }

      const { rowBounds, columnBounds } = getRecordTableAxisBounds(container);

      const newCellRange = computeRecordTableCellRangeFromSelectionBox({
        selectionBox,
        rowBounds,
        columnBounds,
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

  return { updateRecordTableCellRangeFromSelectionBox };
};
