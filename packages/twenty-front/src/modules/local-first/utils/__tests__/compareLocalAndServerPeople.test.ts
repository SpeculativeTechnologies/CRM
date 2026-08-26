import { compareLocalAndServerPeople } from '@/local-first/utils/compareLocalAndServerPeople';
import { type RequestedNodeField } from '@/local-first/utils/extractRequestedNodeFields';

// What the People view asks for on each record, in the shape the query parser
// reports it.
const SYNCED_COLUMNS = [
  'id',
  'nameFirstName',
  'nameLastName',
  'jobTitle',
  'emailsPrimaryEmail',
  'position',
  'updatedAt',
  'avatarFile',
];

const REQUESTED_FIELDS: RequestedNodeField[] = [
  { name: 'id', subFields: [], hasNestedSelections: false },
  {
    name: 'name',
    subFields: ['firstName', 'lastName'],
    hasNestedSelections: false,
  },
  { name: 'jobTitle', subFields: [], hasNestedSelections: false },
  {
    name: 'emails',
    subFields: ['primaryEmail'],
    hasNestedSelections: false,
  },
];

// The API returns composite fields nested; the synced table stores them flat.
const buildServerPerson = (overrides: Record<string, unknown> = {}) => ({
  id: 'person-1',
  name: { firstName: 'Mark', lastName: 'Young' },
  jobTitle: 'Surveyor',
  emails: { primaryEmail: 'mark@example.com' },
  ...overrides,
});

const buildLocalPerson = (overrides: Record<string, unknown> = {}) => ({
  id: 'person-1',
  nameFirstName: 'Mark',
  nameLastName: 'Young',
  jobTitle: 'Surveyor',
  emailsPrimaryEmail: 'mark@example.com',
  ...overrides,
});

describe('compareLocalAndServerPeople', () => {
  it('should match a nested server record against a flat local row', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [buildServerPerson()],
      localRecords: [buildLocalPerson()],
      requestedFields: REQUESTED_FIELDS,
      syncedColumns: SYNCED_COLUMNS,
    });

    expect(result).toMatchObject({ isMatch: true, differences: [] });
    // id, name.firstName, name.lastName, jobTitle, emails.primaryEmail
    expect(result.comparedFieldCount).toBe(5);
  });

  it('should treat null and undefined values as equal', () => {
    expect(
      compareLocalAndServerPeople({
        serverRecords: [buildServerPerson({ jobTitle: null })],
        localRecords: [buildLocalPerson({ jobTitle: undefined })],
        requestedFields: REQUESTED_FIELDS,
        syncedColumns: SYNCED_COLUMNS,
      }).isMatch,
    ).toBe(true);
  });

  // A view that does not show a column does not select it, so the field is
  // absent from the response. Treating absence as an empty value made every
  // row look divergent.
  it('should skip fields the query did not request', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [{ id: 'person-1', name: { firstName: 'Mark' } }],
      localRecords: [buildLocalPerson()],
      requestedFields: REQUESTED_FIELDS,
      syncedColumns: SYNCED_COLUMNS,
    });

    expect(result.isMatch).toBe(true);
    // Only id and name.firstName were selected; the rest are absent.
    expect(result.comparedFieldCount).toBe(2);
  });

  it('should still compare a requested field that is null', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [buildServerPerson({ jobTitle: null })],
      localRecords: [buildLocalPerson({ jobTitle: 'Surveyor' })],
      requestedFields: REQUESTED_FIELDS,
      syncedColumns: SYNCED_COLUMNS,
    });

    expect(result.isMatch).toBe(false);
    expect(result.differences[0]).toBe(
      'person-1.jobTitle: server "", local "Surveyor"',
    );
  });

  it('should report a row count difference, which is what stale sync looks like', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [buildServerPerson()],
      localRecords: [buildLocalPerson(), buildLocalPerson({ id: 'person-2' })],
      requestedFields: REQUESTED_FIELDS,
      syncedColumns: SYNCED_COLUMNS,
    });

    expect(result.isMatch).toBe(false);
    expect(result.differences[0]).toBe('row count: server 1, local 2');
  });

  // The same records in the wrong order is a real bug for a paginated table:
  // page 2 would repeat or skip rows.
  it('should report a divergence when the order differs', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [
        buildServerPerson(),
        buildServerPerson({ id: 'person-2' }),
      ],
      localRecords: [buildLocalPerson({ id: 'person-2' }), buildLocalPerson()],
      requestedFields: REQUESTED_FIELDS,
      syncedColumns: SYNCED_COLUMNS,
    });

    expect(result.isMatch).toBe(false);
    expect(result.differences[0]).toContain('position 0');
  });

  it('should report a stale local value', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [buildServerPerson({ jobTitle: 'Midwife' })],
      localRecords: [buildLocalPerson({ jobTitle: 'Surveyor' })],
      requestedFields: REQUESTED_FIELDS,
      syncedColumns: SYNCED_COLUMNS,
    });

    expect(result.isMatch).toBe(false);
    expect(result.differences[0]).toBe(
      'person-1.jobTitle: server "Midwife", local "Surveyor"',
    );
  });

  // The API sends ISO strings and JSON numbers; PGlite returns Date objects
  // and floats. Without normalisation every row looks divergent.
  it('should ignore timestamp and float serialisation differences', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [
        buildServerPerson({
          updatedAt: '2026-08-25T00:00:00.000Z',
          position: 1.0000001,
        }),
      ],
      localRecords: [
        buildLocalPerson({
          updatedAt: new Date('2026-08-25T00:00:00.000Z'),
          position: 1.00000009,
        }),
      ],
      requestedFields: [
        ...REQUESTED_FIELDS,
        { name: 'updatedAt', subFields: [], hasNestedSelections: false },
        { name: 'position', subFields: [], hasNestedSelections: false },
      ],
      syncedColumns: SYNCED_COLUMNS,
    });

    expect(result.differences).toEqual([]);
    expect(result.isMatch).toBe(true);
  });

  it('should cap the number of reported differences', () => {
    const serverRecords = Array.from({ length: 20 }, (_, index) =>
      buildServerPerson({ id: `person-${index}`, jobTitle: 'server' }),
    );
    const localRecords = serverRecords.map((_, index) =>
      buildLocalPerson({ id: `person-${index}`, jobTitle: 'local' }),
    );

    const result = compareLocalAndServerPeople({
      serverRecords,
      localRecords,
      requestedFields: REQUESTED_FIELDS,
      syncedColumns: SYNCED_COLUMNS,
    });

    expect(result.differences).toHaveLength(5);
  });
});
