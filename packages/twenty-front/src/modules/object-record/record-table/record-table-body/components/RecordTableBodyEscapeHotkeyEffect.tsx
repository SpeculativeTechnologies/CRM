import { Key } from 'ts-key-enum';

import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { useResetTableRowSelection } from '@/object-record/record-table/hooks/internal/useResetTableRowSelection';
import { recordTableCellRangeComponentState } from '@/object-record/record-table/record-table-cell-range/states/recordTableCellRangeComponentState';
import { isAtLeastOneTableRowSelectedSelector } from '@/object-record/record-table/record-table-row/states/isAtLeastOneTableRowSelectedSelector';
import { PageFocusId } from '@/types/PageFocusId';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { useAtomComponentSelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentSelectorValue';
import { useAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentState';
import { isDefined } from 'twenty-shared/utils';

export const RecordTableBodyEscapeHotkeyEffect = () => {
  const { resetTableRowSelection } = useResetTableRowSelection();

  const { recordTableId } = useRecordTableContextOrThrow();

  const [recordTableCellRange, setRecordTableCellRange] = useAtomComponentState(
    recordTableCellRangeComponentState,
    recordTableId,
  );

  const isAtLeastOneRecordSelected = useAtomComponentSelectorValue(
    isAtLeastOneTableRowSelectedSelector,
  );

  const handleEscape = () => {
    if (isDefined(recordTableCellRange)) {
      setRecordTableCellRange(null);
    }

    if (isAtLeastOneRecordSelected) {
      resetTableRowSelection();
    }
  };

  useHotkeysOnFocusedElement({
    keys: [Key.Escape],
    callback: handleEscape,
    focusId: PageFocusId.RecordIndex,
    dependencies: [handleEscape],
    options: {
      preventDefault: true,
    },
  });

  return null;
};
