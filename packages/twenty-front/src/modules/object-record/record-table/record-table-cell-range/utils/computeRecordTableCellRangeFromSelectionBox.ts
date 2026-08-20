import { type RecordTableAxisBound } from '@/object-record/record-table/record-table-cell-range/types/RecordTableAxisBound';
import { type RecordTableCellRange } from '@/object-record/record-table/record-table-cell-range/types/RecordTableCellRange';
import { type SelectionBox } from '@/ui/utilities/drag-select/types/SelectionBox';

// Strict comparisons keep a zero-sized box inside a single cell, so a drag that
// never leaves one cell selects that one cell instead of nothing.
const overlapsBound = (
  boxStart: number,
  boxEnd: number,
  bound: RecordTableAxisBound,
) => bound.start < boxEnd && bound.end > boxStart;

const getCoveredIndices = (
  boxStart: number,
  boxEnd: number,
  bounds: RecordTableAxisBound[],
) =>
  bounds
    .filter((bound) => overlapsBound(boxStart, boxEnd, bound))
    .map((bound) => bound.index);

export const computeRecordTableCellRangeFromSelectionBox = ({
  selectionBox,
  rowBounds,
  columnBounds,
}: {
  selectionBox: SelectionBox;
  rowBounds: RecordTableAxisBound[];
  columnBounds: RecordTableAxisBound[];
}): RecordTableCellRange | null => {
  const coveredRows = getCoveredIndices(
    selectionBox.top,
    selectionBox.top + selectionBox.height,
    rowBounds,
  );

  const coveredColumns = getCoveredIndices(
    selectionBox.left,
    selectionBox.left + selectionBox.width,
    columnBounds,
  );

  if (coveredRows.length === 0 || coveredColumns.length === 0) {
    return null;
  }

  return {
    fromRow: Math.min(...coveredRows),
    toRow: Math.max(...coveredRows),
    fromColumn: Math.min(...coveredColumns),
    toColumn: Math.max(...coveredColumns),
  };
};
