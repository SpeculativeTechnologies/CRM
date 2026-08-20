import { getRecordTableCellRangeBoxShadow } from '@/object-record/record-table/record-table-cell-range/utils/getRecordTableCellRangeBoxShadow';

describe('getRecordTableCellRangeBoxShadow', () => {
  it('should return undefined for a cell outside the range', () => {
    expect(
      getRecordTableCellRangeBoxShadow({
        selectedRangeEdges: '',
        color: 'blue',
      }),
    ).toBeUndefined();
  });

  it('should return undefined for an interior cell with no edges', () => {
    expect(
      getRecordTableCellRangeBoxShadow({
        selectedRangeEdges: 'inside',
        color: 'blue',
      }),
    ).toBeUndefined();
  });

  it('should outline a single cell range on all four sides', () => {
    expect(
      getRecordTableCellRangeBoxShadow({
        selectedRangeEdges: 'inside top bottom left right',
        color: 'blue',
      }),
    ).toBe(
      'inset 0 1px 0 0 blue, inset 0 -1px 0 0 blue, inset 1px 0 0 0 blue, inset -1px 0 0 0 blue',
    );
  });

  it('should outline only the edges the cell sits on', () => {
    expect(
      getRecordTableCellRangeBoxShadow({
        selectedRangeEdges: 'inside top left',
        color: 'blue',
      }),
    ).toBe('inset 0 1px 0 0 blue, inset 1px 0 0 0 blue');
  });
});
