// Row indices are positions in the flat list of every record the table holds,
// including records inside a collapsed or hidden record group, which render
// nothing. A range spans a contiguous index run, so a drag across a collapsed
// group covers indices that were never on screen. Reading back the rendered
// rows keeps a copy to what the range actually painted.
export const getRenderedRecordTableRowIndices = (
  container: HTMLElement,
): Set<number> => {
  const rowIndices = new Set<number>();

  const cells = container.querySelectorAll<HTMLElement>(
    '[data-record-table-row]',
  );

  for (const cell of cells) {
    const rowIndex = Number(cell.dataset.recordTableRow);

    if (!Number.isNaN(rowIndex)) {
      rowIndices.add(rowIndex);
    }
  }

  return rowIndices;
};
