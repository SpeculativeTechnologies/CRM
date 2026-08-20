// A cell holding a tab or a newline would otherwise split into extra columns or
// rows on paste, shifting everything after it. Quoting is what spreadsheets
// expect, so only the cells that need it carry quotes.
const quoteCellIfNeeded = (cell: string) =>
  /["\t\n\r]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;

// Tab-separated rows so a multi-cell copy pastes as columns into a spreadsheet.
// A single cell stays verbatim, matching what copying that cell on its own
// gives, since there is no structure for a stray tab to break.
export const formatRecordTableCellRangeAsText = (rows: string[][]) => {
  const isSingleCell = rows.length === 1 && rows[0].length === 1;

  if (isSingleCell) {
    return rows[0][0];
  }

  return rows
    .map((cells) => cells.map(quoteCellIfNeeded).join('\t'))
    .join('\n');
};
