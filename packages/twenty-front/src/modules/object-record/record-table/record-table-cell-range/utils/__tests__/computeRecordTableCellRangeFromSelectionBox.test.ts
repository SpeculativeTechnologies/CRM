import { computeRecordTableCellRangeFromSelectionBox } from '@/object-record/record-table/record-table-cell-range/utils/computeRecordTableCellRangeFromSelectionBox';
import { type RecordTableAxisBound } from '@/object-record/record-table/record-table-cell-range/types/RecordTableAxisBound';

// three 32px rows, three 100px columns
const rowBounds: RecordTableAxisBound[] = [
  { index: 0, start: 0, end: 32 },
  { index: 1, start: 32, end: 64 },
  { index: 2, start: 64, end: 96 },
];

const columnBounds: RecordTableAxisBound[] = [
  { index: 0, start: 0, end: 100 },
  { index: 1, start: 100, end: 200 },
  { index: 2, start: 200, end: 300 },
];

describe('computeRecordTableCellRangeFromSelectionBox', () => {
  it('should select only the covered cells when the box spans several rows and columns', () => {
    expect(
      computeRecordTableCellRangeFromSelectionBox({
        selectionBox: { top: 10, left: 10, height: 40, width: 120 },
        rowBounds,
        columnBounds,
      }),
    ).toEqual({ fromRow: 0, toRow: 1, fromColumn: 0, toColumn: 1 });
  });

  it('should select a single cell when the box stays inside one cell', () => {
    expect(
      computeRecordTableCellRangeFromSelectionBox({
        selectionBox: { top: 40, left: 110, height: 8, width: 20 },
        rowBounds,
        columnBounds,
      }),
    ).toEqual({ fromRow: 1, toRow: 1, fromColumn: 1, toColumn: 1 });
  });

  it('should select a single cell for a zero-sized box inside that cell', () => {
    expect(
      computeRecordTableCellRangeFromSelectionBox({
        selectionBox: { top: 70, left: 250, height: 0, width: 0 },
        rowBounds,
        columnBounds,
      }),
    ).toEqual({ fromRow: 2, toRow: 2, fromColumn: 2, toColumn: 2 });
  });

  it('should not extend to a neighbour the box only touches at the border', () => {
    expect(
      computeRecordTableCellRangeFromSelectionBox({
        selectionBox: { top: 32, left: 100, height: 32, width: 100 },
        rowBounds,
        columnBounds,
      }),
    ).toEqual({ fromRow: 1, toRow: 1, fromColumn: 1, toColumn: 1 });
  });

  it('should normalise a range dragged upwards and leftwards', () => {
    expect(
      computeRecordTableCellRangeFromSelectionBox({
        selectionBox: { top: 20, left: 50, height: 60, width: 200 },
        rowBounds,
        columnBounds,
      }),
    ).toEqual({ fromRow: 0, toRow: 2, fromColumn: 0, toColumn: 2 });
  });

  it('should return null when the box misses every row', () => {
    expect(
      computeRecordTableCellRangeFromSelectionBox({
        selectionBox: { top: 200, left: 10, height: 20, width: 20 },
        rowBounds,
        columnBounds,
      }),
    ).toBeNull();
  });

  it('should return null when there are no cells to cover', () => {
    expect(
      computeRecordTableCellRangeFromSelectionBox({
        selectionBox: { top: 0, left: 0, height: 50, width: 50 },
        rowBounds: [],
        columnBounds: [],
      }),
    ).toBeNull();
  });
});
