import { getRenderedRecordTableRowIndices } from '@/object-record/record-table/record-table-cell-range/utils/getRenderedRecordTableRowIndices';

const buildContainer = (rowIndices: (number | string)[]) => {
  const container = document.createElement('div');

  for (const rowIndex of rowIndices) {
    const cell = document.createElement('div');

    cell.dataset.recordTableRow = String(rowIndex);
    container.appendChild(cell);
  }

  return container;
};

describe('getRenderedRecordTableRowIndices', () => {
  it('should collect every rendered row index once', () => {
    const container = buildContainer([0, 0, 1, 1, 2]);

    expect(getRenderedRecordTableRowIndices(container)).toEqual(
      new Set([0, 1, 2]),
    );
  });

  it('should omit the indices of a collapsed group', () => {
    const container = buildContainer([0, 1, 5, 6]);

    expect(getRenderedRecordTableRowIndices(container)).toEqual(
      new Set([0, 1, 5, 6]),
    );
  });

  it('should ignore cells whose row index is not a number', () => {
    const container = buildContainer([0, 'not-a-number', 1]);

    expect(getRenderedRecordTableRowIndices(container)).toEqual(new Set([0, 1]));
  });

  it('should return an empty set for a container with no rows', () => {
    expect(getRenderedRecordTableRowIndices(buildContainer([]))).toEqual(
      new Set(),
    );
  });
});
