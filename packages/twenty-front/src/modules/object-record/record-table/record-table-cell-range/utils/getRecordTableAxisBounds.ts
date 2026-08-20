import { type RecordTableAxisBound } from '@/object-record/record-table/record-table-cell-range/types/RecordTableAxisBound';

// Measuring one cell per row and one per column keeps the drag loop at
// rows + columns rect reads instead of one per cell.
export const getRecordTableAxisBounds = (container: HTMLElement) => {
  const cells = container.querySelectorAll<HTMLElement>(
    '[data-record-table-row][data-record-table-col]',
  );

  const cellElementByRow = new Map<number, HTMLElement>();
  const cellElementByColumn = new Map<number, HTMLElement>();

  for (const cell of cells) {
    const row = Number(cell.dataset.recordTableRow);
    const column = Number(cell.dataset.recordTableCol);

    if (Number.isNaN(row) || Number.isNaN(column)) {
      continue;
    }

    if (!cellElementByRow.has(row)) {
      cellElementByRow.set(row, cell);
    }

    if (!cellElementByColumn.has(column)) {
      cellElementByColumn.set(column, cell);
    }
  }

  const containerRect = container.getBoundingClientRect();

  const rowBounds: RecordTableAxisBound[] = [...cellElementByRow].map(
    ([index, cell]) => {
      const rect = cell.getBoundingClientRect();

      return {
        index,
        start: rect.top - containerRect.top,
        end: rect.bottom - containerRect.top,
      };
    },
  );

  const columnBounds: RecordTableAxisBound[] = [...cellElementByColumn].map(
    ([index, cell]) => {
      const rect = cell.getBoundingClientRect();

      return {
        index,
        start: rect.left - containerRect.left,
        end: rect.right - containerRect.left,
      };
    },
  );

  return { rowBounds, columnBounds };
};
