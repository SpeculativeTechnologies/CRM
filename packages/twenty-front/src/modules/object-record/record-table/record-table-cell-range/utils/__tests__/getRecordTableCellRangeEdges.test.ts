import {
  getRecordTableCellRangeEdges,
  RECORD_TABLE_CELL_RANGE_INSIDE,
} from '@/object-record/record-table/record-table-cell-range/utils/getRecordTableCellRangeEdges';

const cellRange = { fromRow: 1, toRow: 3, fromColumn: 2, toColumn: 4 };

describe('getRecordTableCellRangeEdges', () => {
  it('should return an empty string for a cell outside the range', () => {
    expect(
      getRecordTableCellRangeEdges({
        cellRange,
        cellPosition: { row: 0, column: 2 },
      }),
    ).toBe('');
  });

  it('should return an empty string when no range is painted', () => {
    expect(
      getRecordTableCellRangeEdges({
        cellRange: null,
        cellPosition: { row: 1, column: 2 },
      }),
    ).toBe('');
  });

  it('should mark an interior cell as inside with no edges', () => {
    expect(
      getRecordTableCellRangeEdges({
        cellRange,
        cellPosition: { row: 2, column: 3 },
      }),
    ).toBe(RECORD_TABLE_CELL_RANGE_INSIDE);
  });

  it('should mark the top left corner with both of its edges', () => {
    expect(
      getRecordTableCellRangeEdges({
        cellRange,
        cellPosition: { row: 1, column: 2 },
      }),
    ).toBe(`${RECORD_TABLE_CELL_RANGE_INSIDE} top left`);
  });

  it('should mark the bottom right corner with both of its edges', () => {
    expect(
      getRecordTableCellRangeEdges({
        cellRange,
        cellPosition: { row: 3, column: 4 },
      }),
    ).toBe(`${RECORD_TABLE_CELL_RANGE_INSIDE} bottom right`);
  });

  it('should mark all four edges for a single cell range', () => {
    expect(
      getRecordTableCellRangeEdges({
        cellRange: { fromRow: 5, toRow: 5, fromColumn: 6, toColumn: 6 },
        cellPosition: { row: 5, column: 6 },
      }),
    ).toBe(`${RECORD_TABLE_CELL_RANGE_INSIDE} top bottom left right`);
  });

  it('should mark only the vertical edges for a cell in the middle column', () => {
    expect(
      getRecordTableCellRangeEdges({
        cellRange,
        cellPosition: { row: 1, column: 3 },
      }),
    ).toBe(`${RECORD_TABLE_CELL_RANGE_INSIDE} top`);
  });
});
