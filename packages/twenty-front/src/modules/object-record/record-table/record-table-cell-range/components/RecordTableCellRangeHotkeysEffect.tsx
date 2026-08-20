import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { useCopyRecordTableCellRange } from '@/object-record/record-table/record-table-cell-range/hooks/useCopyRecordTableCellRange';
import { recordTableCellRangeComponentState } from '@/object-record/record-table/record-table-cell-range/states/recordTableCellRangeComponentState';
import { PageFocusId } from '@/types/PageFocusId';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { useAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentState';
import { Key } from 'ts-key-enum';
import { isDefined } from 'twenty-shared/utils';

export const RecordTableCellRangeHotkeysEffect = () => {
  const { recordTableId } = useRecordTableContextOrThrow();

  const [recordTableCellRange, setRecordTableCellRange] = useAtomComponentState(
    recordTableCellRangeComponentState,
    recordTableId,
  );

  const { copyRecordTableCellRange } = useCopyRecordTableCellRange();

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
  });

  return null;
};
