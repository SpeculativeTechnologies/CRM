import { compareLocalAndServerPeople } from '@/local-first/utils/compareLocalAndServerPeople';
import { type RequestedNodeField } from '@/local-first/utils/extractRequestedNodeFields';

// Both sides are in the API's shape by the time they are compared: the local
// mirror assembles records, it does not hand back raw rows.
const REQUESTED_FIELDS: RequestedNodeField[] = [
  { name: 'id', subFields: [], relation: null },
  { name: 'jobTitle', subFields: [], relation: null },
  { name: 'name', subFields: ['firstName', 'lastName'], relation: null },
  {
    name: 'company',
    subFields: [],
    relation: {
      kind: 'toOne',
      nodeFields: [
        { name: 'id', subFields: [], relation: null },
        { name: 'name', subFields: [], relation: null },
      ],
    },
  },
  {
    name: 'previousCompanies',
    subFields: [],
    relation: {
      kind: 'toMany',
      nodeFields: [{ name: 'id', subFields: [], relation: null }],
    },
  },
];

const buildConnection = (nodes: Record<string, unknown>[]) => ({
  edges: nodes.map((node) => ({ node })),
});

const buildPerson = (overrides: Record<string, unknown> = {}) => ({
  id: 'person-1',
  jobTitle: 'Surveyor',
  name: { firstName: 'Mark', lastName: 'Young' },
  company: { id: 'company-1', name: 'Apple' },
  previousCompanies: buildConnection([{ id: 'history-1' }]),
  ...overrides,
});

describe('compareLocalAndServerPeople', () => {
  it('should match identical records including relations', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [buildPerson()],
      localRecords: [buildPerson()],
      requestedFields: REQUESTED_FIELDS,
    });

    expect(result).toMatchObject({ isMatch: true, differences: [] });
    // id, jobTitle, name.firstName, name.lastName, company.id, company.name,
    // previousCompanies[0].id
    expect(result.comparedFieldCount).toBe(7);
  });

  it('should treat null and undefined values as equal', () => {
    expect(
      compareLocalAndServerPeople({
        serverRecords: [buildPerson({ jobTitle: null })],
        localRecords: [buildPerson({ jobTitle: undefined })],
        requestedFields: REQUESTED_FIELDS,
      }).isMatch,
    ).toBe(true);
  });

  // A view that does not show a column does not select it, so the field is
  // absent from the response. Absence is not a divergence.
  it('should skip fields the query did not request', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [{ id: 'person-1', jobTitle: 'Surveyor' }],
      localRecords: [buildPerson()],
      requestedFields: REQUESTED_FIELDS,
    });

    expect(result.isMatch).toBe(true);
    expect(result.comparedFieldCount).toBe(2);
  });

  it('should report a row count difference, which is what stale sync looks like', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [buildPerson()],
      localRecords: [buildPerson(), buildPerson({ id: 'person-2' })],
      requestedFields: REQUESTED_FIELDS,
    });

    expect(result.isMatch).toBe(false);
    expect(result.differences[0]).toBe('row count: server 1, local 2');
  });

  // The same records in the wrong order is a real bug for a paginated table:
  // page 2 would repeat or skip rows.
  it('should report a divergence when the order differs', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [buildPerson(), buildPerson({ id: 'person-2' })],
      localRecords: [buildPerson({ id: 'person-2' }), buildPerson()],
      requestedFields: REQUESTED_FIELDS,
    });

    expect(result.isMatch).toBe(false);
    expect(result.differences[0]).toContain('position 0');
  });

  it('should report a stale scalar value', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [buildPerson({ jobTitle: 'Midwife' })],
      localRecords: [buildPerson({ jobTitle: 'Surveyor' })],
      requestedFields: REQUESTED_FIELDS,
    });

    expect(result.isMatch).toBe(false);
    expect(result.differences[0]).toBe(
      'jobTitle: server "Midwife", local "Surveyor"',
    );
  });

  it('should report a divergence inside a composite', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [buildPerson()],
      localRecords: [
        buildPerson({ name: { firstName: 'Marc', lastName: 'Young' } }),
      ],
      requestedFields: REQUESTED_FIELDS,
    });

    expect(result.differences[0]).toBe(
      'name.firstName: server "Mark", local "Marc"',
    );
  });

  // A wrong join is the failure mode that matters most for relations: the row
  // is right but it is attached to the wrong related record.
  it('should report a divergence inside a to-one relation', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [buildPerson()],
      localRecords: [
        buildPerson({ company: { id: 'company-2', name: 'Other' } }),
      ],
      requestedFields: REQUESTED_FIELDS,
    });

    expect(result.isMatch).toBe(false);
    expect(result.differences[0]).toBe(
      'company.id: server "company-1", local "company-2"',
    );
  });

  it('should compare a null to-one relation as a value', () => {
    expect(
      compareLocalAndServerPeople({
        serverRecords: [buildPerson({ company: null })],
        localRecords: [buildPerson({ company: null })],
        requestedFields: REQUESTED_FIELDS,
      }).isMatch,
    ).toBe(true);

    expect(
      compareLocalAndServerPeople({
        serverRecords: [buildPerson({ company: null })],
        localRecords: [buildPerson()],
        requestedFields: REQUESTED_FIELDS,
      }).isMatch,
    ).toBe(false);
  });

  it('should report a to-many relation with the wrong number of records', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [buildPerson()],
      localRecords: [
        buildPerson({
          previousCompanies: buildConnection([
            { id: 'history-1' },
            { id: 'history-2' },
          ]),
        }),
      ],
      requestedFields: REQUESTED_FIELDS,
    });

    expect(result.isMatch).toBe(false);
    expect(result.differences[0]).toBe(
      'previousCompanies: server 1 related, local 2',
    );
  });

  it('should report a divergence inside a to-many relation record', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [buildPerson()],
      localRecords: [
        buildPerson({ previousCompanies: buildConnection([{ id: 'other' }]) }),
      ],
      requestedFields: REQUESTED_FIELDS,
    });

    expect(result.differences[0]).toBe(
      'previousCompanies[0].id: server "history-1", local "other"',
    );
  });

  // The API sends ISO strings and JSON numbers; PGlite returns Date objects
  // and floats. Without normalisation every row looks divergent.
  it('should ignore timestamp and float serialisation differences', () => {
    const result = compareLocalAndServerPeople({
      serverRecords: [
        buildPerson({
          updatedAt: '2026-08-25T00:00:00.000Z',
          position: 1.0000001,
        }),
      ],
      localRecords: [
        buildPerson({
          updatedAt: new Date('2026-08-25T00:00:00.000Z'),
          position: 1.00000009,
        }),
      ],
      requestedFields: [
        ...REQUESTED_FIELDS,
        { name: 'updatedAt', subFields: [], relation: null },
        { name: 'position', subFields: [], relation: null },
      ],
    });

    expect(result.differences).toEqual([]);
  });

  it('should cap the number of reported differences', () => {
    const serverRecords = Array.from({ length: 20 }, (_, index) =>
      buildPerson({ id: `person-${index}`, jobTitle: 'server' }),
    );
    const localRecords = serverRecords.map((record) => ({
      ...record,
      jobTitle: 'local',
    }));

    const result = compareLocalAndServerPeople({
      serverRecords,
      localRecords,
      requestedFields: REQUESTED_FIELDS,
    });

    expect(result.differences).toHaveLength(5);
  });
});
