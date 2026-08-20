// Tab-separated rows so a multi-cell copy pastes as columns into a spreadsheet,
// while a single cell stays plain text.
export const formatRecordTableCellRangeAsText = (rows: string[][]) =>
  rows.map((cells) => cells.join('\t')).join('\n');
