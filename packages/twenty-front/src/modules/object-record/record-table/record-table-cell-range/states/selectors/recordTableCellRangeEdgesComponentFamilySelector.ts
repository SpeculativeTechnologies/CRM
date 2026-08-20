import { recordTableCellRangeComponentState } from '@/object-record/record-table/record-table-cell-range/states/recordTableCellRangeComponentState';
import { getRecordTableCellRangeEdges } from '@/object-record/record-table/record-table-cell-range/utils/getRecordTableCellRangeEdges';
import { RecordTableComponentInstanceContext } from '@/object-record/record-table/states/context/RecordTableComponentInstanceContext';
import { type TableCellPosition } from '@/object-record/record-table/types/TableCellPosition';
import { createAtomComponentFamilySelector } from '@/ui/utilities/state/jotai/utils/createAtomComponentFamilySelector';

// Per-cell and primitive, so painting a range only re-renders the cells whose
// membership or edges actually changed rather than every cell in the table.
export const recordTableCellRangeEdgesComponentFamilySelector =
  createAtomComponentFamilySelector<string, TableCellPosition>({
    key: 'recordTableCellRangeEdgesComponentFamilySelector',
    componentInstanceContext: RecordTableComponentInstanceContext,
    get:
      ({ instanceId, familyKey }) =>
      ({ get }): string =>
        getRecordTableCellRangeEdges({
          cellRange: get(recordTableCellRangeComponentState, { instanceId }),
          cellPosition: familyKey,
        }),
  });
