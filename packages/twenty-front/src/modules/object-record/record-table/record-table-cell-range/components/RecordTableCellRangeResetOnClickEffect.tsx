import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { recordTableCellRangeComponentState } from '@/object-record/record-table/record-table-cell-range/states/recordTableCellRangeComponentState';
import { useAtomComponentStateCallbackState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateCallbackState';
import { useStore } from 'jotai';
import { useEffect } from 'react';
import { isDefined } from 'twenty-shared/utils';

const LEFT_MOUSE_BUTTON = 0;

// Any left click drops the range, wherever it lands. A drag starts with the
// same mousedown, so it clears the previous range and paints the new one as the
// pointer moves.
export const RecordTableCellRangeResetOnClickEffect = () => {
  const { recordTableId } = useRecordTableContextOrThrow();

  const recordTableCellRange = useAtomComponentStateCallbackState(
    recordTableCellRangeComponentState,
    recordTableId,
  );

  const store = useStore();

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== LEFT_MOUSE_BUTTON) {
        return;
      }

      if (!isDefined(store.get(recordTableCellRange))) {
        return;
      }

      store.set(recordTableCellRange, null);
    };

    document.addEventListener('mousedown', handleMouseDown);

    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [recordTableCellRange, store]);

  return null;
};
