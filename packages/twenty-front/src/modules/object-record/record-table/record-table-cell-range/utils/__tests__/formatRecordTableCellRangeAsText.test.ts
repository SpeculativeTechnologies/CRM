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

  it('should quote a cell holding a tab or a newline so columns stay aligned', () => {
    expect(
      formatRecordTableCellRangeAsText([
        ['first\tsecond', 'Jane Doe'],
        ['line one\nline two', 'John Doe'],
      ]),
    ).toBe('"first\tsecond"\tJane Doe\n"line one\nline two"\tJohn Doe');
  });

  it('should double the quotes inside a quoted cell', () => {
    expect(
      formatRecordTableCellRangeAsText([['say "hi"\tnow', 'Jane Doe']]),
    ).toBe('"say ""hi""\tnow"\tJane Doe');
  });

  it('should leave a lone cell verbatim even when it holds a newline', () => {
    expect(formatRecordTableCellRangeAsText([['line one\nline two']])).toBe(
      'line one\nline two',
    );
  });
});
