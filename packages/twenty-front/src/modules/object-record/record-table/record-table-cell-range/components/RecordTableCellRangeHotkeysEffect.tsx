import { Key } from 'ts-key-enum';

import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { useCopyRecordTableCellRange } from '@/object-record/record-table/record-table-cell-range/hooks/useCopyRecordTableCellRange';
import { recordTableCellRangeComponentState } from '@/object-record/record-table/record-table-cell-range/states/recordTableCellRangeComponentState';
import { PageFocusId } from '@/types/PageFocusId';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { useAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentState';
import { type RefObject } from 'react';
import { isDefined } from 'twenty-shared/utils';

// Clearing the range used to live in RecordTableBodyEscapeHotkeyEffect, which
// upstream removed in favor of the shared RecordSelectionEscapeHotkeyEffect.
// Escape clearing is table-scoped (it needs the cell range state), so it lives
// here alongside the copy hotkey. The shared handler still resets row selection.
export const RecordTableCellRangeHotkeysEffect = ({
  containerRef,
}: {
  containerRef: RefObject<HTMLElement | null>;
}) => {
  const { recordTableId } = useRecordTableContextOrThrow();

  const [recordTableCellRange, setRecordTableCellRange] = useAtomComponentState(
    recordTableCellRangeComponentState,
    recordTableId,
  );

  const { copyRecordTableCellRange } = useCopyRecordTableCellRange({
    containerRef,
  });

  const handleCopy = () => {
    copyRecordTableCellRange();
  };

  const handleEscape = () => {
    if (isDefined(recordTableCellRange)) {
      setRecordTableCellRange(null);
    }
  };

  useHotkeysOnFocusedElement({
    keys: ['ctrl+c,meta+c'],
    callback: handleCopy,
    focusId: PageFocusId.RecordIndex,
    dependencies: [handleCopy],
    options: {
      enableOnFormTags: false,
    },
  });

  useHotkeysOnFocusedElement({
    keys: [Key.Escape],
    callback: handleEscape,
    focusId: PageFocusId.RecordIndex,
    dependencies: [handleEscape],
    options: {
      preventDefault: false,
    },
  });

  return null;
};
