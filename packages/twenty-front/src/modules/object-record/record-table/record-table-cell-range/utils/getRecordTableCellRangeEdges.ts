import { type RecordTableCellRange } from '@/object-record/record-table/record-table-cell-range/types/RecordTableCellRange';
import { isCellInRecordTableCellRange } from '@/object-record/record-table/record-table-cell-range/utils/isCellInRecordTableCellRange';
import { type TableCellPosition } from '@/object-record/record-table/types/TableCellPosition';
import { isDefined } from 'twenty-shared/utils';

export const RECORD_TABLE_CELL_RANGE_INSIDE = 'inside';

// Returned as a string so the component selector keeps returning a primitive:
// an object would be a new reference on every recompute and re-render every
// cell. '' means the cell is outside the range; a cell inside it always carries
// the "inside" marker, plus one entry per range edge it sits on.
export const getRecordTableCellRangeEdges = ({
  cellRange,
  cellPosition,
}: {
  cellRange: RecordTableCellRange | null;
  cellPosition: TableCellPosition;
}): string => {
  if (
    !isDefined(cellRange) ||
    !isCellInRecordTableCellRange({ cellRange, cellPosition })
  ) {
    return '';
  }

  return [
    RECORD_TABLE_CELL_RANGE_INSIDE,
    cellPosition.row === cellRange.fromRow ? 'top' : '',
    cellPosition.row === cellRange.toRow ? 'bottom' : '',
    cellPosition.column === cellRange.fromColumn ? 'left' : '',
    cellPosition.column === cellRange.toColumn ? 'right' : '',
  ]
    .filter((edge) => edge !== '')
    .join(' ');
};
