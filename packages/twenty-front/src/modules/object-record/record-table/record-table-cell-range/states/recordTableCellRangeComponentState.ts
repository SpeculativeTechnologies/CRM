import { type RecordTableCellRange } from '@/object-record/record-table/record-table-cell-range/types/RecordTableCellRange';
import { RecordTableComponentInstanceContext } from '@/object-record/record-table/states/context/RecordTableComponentInstanceContext';
import { createAtomComponentState } from '@/ui/utilities/state/jotai/utils/createAtomComponentState';

export const recordTableCellRangeComponentState =
  createAtomComponentState<RecordTableCellRange | null>({
    key: 'recordTableCellRangeComponentState',
    defaultValue: null,
    componentInstanceContext: RecordTableComponentInstanceContext,
  });
