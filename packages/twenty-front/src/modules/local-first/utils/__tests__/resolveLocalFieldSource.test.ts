import {
  readLocalFieldValue,
  resolveLocalFieldSource,
} from '@/local-first/utils/resolveLocalFieldSource';

const SYNCED_COLUMNS = new Set([
  'id',
  'nameFirstName',
  'jobTitle',
  'avatarFile',
]);

describe('resolveLocalFieldSource', () => {
  it('should resolve a scalar field to its own column', () => {
    expect(
      resolveLocalFieldSource({
        fieldName: 'jobTitle',
        syncedColumns: SYNCED_COLUMNS,
      }),
    ).toEqual({ column: 'jobTitle', jsonKey: null });
  });

  // name { firstName } is stored as the column nameFirstName.
  it('should resolve a composite subfield to its flattened column', () => {
    expect(
      resolveLocalFieldSource({
        fieldName: 'name',
        subFieldName: 'firstName',
        syncedColumns: SYNCED_COLUMNS,
      }),
    ).toEqual({ column: 'nameFirstName', jsonKey: null });
  });

  // avatarFile { url } is a single jsonb column holding the whole object, so
  // the same composite shape flattens two different ways in this schema.
  it('should resolve a composite subfield held inside a jsonb column', () => {
    expect(
      resolveLocalFieldSource({
        fieldName: 'avatarFile',
        subFieldName: 'url',
        syncedColumns: SYNCED_COLUMNS,
      }),
    ).toEqual({ column: 'avatarFile', jsonKey: 'url' });
  });

  it('should return null for a field that is not in the mirror', () => {
    expect(
      resolveLocalFieldSource({
        fieldName: 'company',
        subFieldName: 'name',
        syncedColumns: SYNCED_COLUMNS,
      }),
    ).toBeNull();
  });
});

describe('readLocalFieldValue', () => {
  it('should read a plain column', () => {
    expect(
      readLocalFieldValue({
        record: { jobTitle: 'Surveyor' },
        source: { column: 'jobTitle', jsonKey: null },
      }),
    ).toBe('Surveyor');
  });

  it('should read a key out of a jsonb column', () => {
    expect(
      readLocalFieldValue({
        record: { avatarFile: { url: 'https://example.com/a.png' } },
        source: { column: 'avatarFile', jsonKey: 'url' },
      }),
    ).toBe('https://example.com/a.png');
  });

  it('should read null when the jsonb column is empty', () => {
    expect(
      readLocalFieldValue({
        record: { avatarFile: null },
        source: { column: 'avatarFile', jsonKey: 'url' },
      }),
    ).toBeNull();
  });
});
