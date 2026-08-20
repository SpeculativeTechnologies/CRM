import { type RecordTableCellRange } from '@/object-record/record-table/record-table-cell-range/types/RecordTableCellRange';
import { type TableCellPosition } from '@/object-record/record-table/types/TableCellPosition';
import { isDefined } from 'twenty-shared/utils';

export const isCellInRecordTableCellRange = ({
  cellRange,
  cellPosition,
}: {
  cellRange: RecordTableCellRange | null;
  cellPosition: TableCellPosition;
}) =>
  isDefined(cellRange) &&
  cellPosition.row >= cellRange.fromRow &&
  cellPosition.row <= cellRange.toRow &&
  cellPosition.column >= cellRange.fromColumn &&
  cellPosition.column <= cellRange.toColumn;
