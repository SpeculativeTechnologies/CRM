import { compareLocalAndServerPeople } from '@/local-first/utils/compareLocalAndServerPeople';

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
    });

    expect(result).toMatchObject({ isMatch: true, differences: [] });
    expect(result.comparedFieldCount).toBe(4);
  });

  it('should treat null and undefined values as equal', () => {
    expect(
      compareLocalAndServerPeople({
        serverRecords: [buildServerPerson({ jobTitle: null })],
        localRecords: [buildLocalPerson({ jobTitle: undefined })],
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
    });

    expect(result.isMatch).toBe(true);
    expect(result.comparedFieldCount).toBe(1);
  });

  it('should still compare a requested field that is null', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [buildServerPerson({ jobTitle: null })],
      localRecords: [buildLocalPerson({ jobTitle: 'Surveyor' })],
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
    });

    expect(result.isMatch).toBe(false);
    expect(result.differences[0]).toContain('position 0');
  });

  it('should report a stale local value', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [buildServerPerson({ jobTitle: 'Midwife' })],
      localRecords: [buildLocalPerson({ jobTitle: 'Surveyor' })],
    });

    expect(result.isMatch).toBe(false);
    expect(result.differences[0]).toBe(
      'person-1.jobTitle: server "Midwife", local "Surveyor"',
    );
  });

  it('should ignore timestamp and position serialisation differences', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [
        buildServerPerson({
          updatedAt: '2026-08-25T00:00:00.000Z',
          position: 1,
        }),
      ],
      localRecords: [
        buildLocalPerson({
          updatedAt: new Date('2026-08-25'),
          position: 1.0000001,
        }),
      ],
    });

    expect(result.isMatch).toBe(true);
  });

  it('should cap the number of reported differences', () => {
    const serverRecords = Array.from({ length: 20 }, (_, index) =>
      buildServerPerson({ id: `person-${index}`, jobTitle: 'server' }),
    );
    const localRecords = serverRecords.map((_, index) =>
      buildLocalPerson({ id: `person-${index}`, jobTitle: 'local' }),
    );

    const result = compareLocalAndServerPeople({ serverRecords, localRecords });

    expect(result.differences).toHaveLength(5);
  });
});
