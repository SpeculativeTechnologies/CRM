import { recordTableCellRangeComponentState } from '@/object-record/record-table/record-table-cell-range/states/recordTableCellRangeComponentState';
import { isCellInRecordTableCellRange } from '@/object-record/record-table/record-table-cell-range/utils/isCellInRecordTableCellRange';
import { RecordTableComponentInstanceContext } from '@/object-record/record-table/states/context/RecordTableComponentInstanceContext';
import { type TableCellPosition } from '@/object-record/record-table/types/TableCellPosition';
import { createAtomComponentFamilySelector } from '@/ui/utilities/state/jotai/utils/createAtomComponentFamilySelector';

// A per-cell boolean, so painting a range only re-renders the cells whose
// membership actually flipped rather than every cell in the table.
export const isCellInRecordTableCellRangeComponentFamilySelector =
  createAtomComponentFamilySelector<boolean, TableCellPosition>({
    key: 'isCellInRecordTableCellRangeComponentFamilySelector',
    componentInstanceContext: RecordTableComponentInstanceContext,
    get:
      ({ instanceId, familyKey }) =>
      ({ get }): boolean =>
        isCellInRecordTableCellRange({
          cellRange: get(recordTableCellRangeComponentState, { instanceId }),
          cellPosition: familyKey,
        }),
  });
