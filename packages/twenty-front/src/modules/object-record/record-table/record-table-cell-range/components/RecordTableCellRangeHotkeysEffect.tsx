import { useCopyRecordTableCellRange } from '@/object-record/record-table/record-table-cell-range/hooks/useCopyRecordTableCellRange';
import { PageFocusId } from '@/types/PageFocusId';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';

// Clearing the range lives in RecordTableBodyEscapeHotkeyEffect: a second
// handler on the same key and focus id never fires.
export const RecordTableCellRangeHotkeysEffect = () => {
  const { copyRecordTableCellRange } = useCopyRecordTableCellRange();

  const handleCopy = () => {
    copyRecordTableCellRange();
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

  return null;
};
