import { isCellInRecordTableCellRange } from '@/object-record/record-table/record-table-cell-range/utils/isCellInRecordTableCellRange';

const cellRange = { fromRow: 1, toRow: 3, fromColumn: 2, toColumn: 4 };

describe('isCellInRecordTableCellRange', () => {
  it.each([
    [{ row: 1, column: 2 }, true],
    [{ row: 3, column: 4 }, true],
    [{ row: 2, column: 3 }, true],
    [{ row: 0, column: 3 }, false],
    [{ row: 4, column: 3 }, false],
    [{ row: 2, column: 1 }, false],
    [{ row: 2, column: 5 }, false],
  ] as const)('should return %s for %o', (cellPosition, expected) => {
    expect(isCellInRecordTableCellRange({ cellRange, cellPosition })).toBe(
      expected,
    );
  });

  it('should return false when no range is painted', () => {
    expect(
      isCellInRecordTableCellRange({
        cellRange: null,
        cellPosition: { row: 1, column: 2 },
      }),
    ).toBe(false);
  });
});
