import { formatRecordTableCellRangeAsText } from '@/object-record/record-table/record-table-cell-range/utils/formatRecordTableCellRangeAsText';

describe('formatRecordTableCellRangeAsText', () => {
  it('should return a single cell as plain text', () => {
    expect(formatRecordTableCellRangeAsText([['Acme Inc']])).toBe('Acme Inc');
  });

  it('should tab-separate columns and newline-separate rows', () => {
    expect(
      formatRecordTableCellRangeAsText([
        ['Acme Inc', 'acme.com'],
        ['Globex', 'globex.com'],
      ]),
    ).toBe('Acme Inc\tacme.com\nGlobex\tglobex.com');
  });

  it('should keep empty cells as empty columns', () => {
    expect(
      formatRecordTableCellRangeAsText([['Acme Inc', '', 'Jane Doe']]),
    ).toBe('Acme Inc\t\tJane Doe');
  });

  it('should return an empty string for no rows', () => {
    expect(formatRecordTableCellRangeAsText([])).toBe('');
  });
});
