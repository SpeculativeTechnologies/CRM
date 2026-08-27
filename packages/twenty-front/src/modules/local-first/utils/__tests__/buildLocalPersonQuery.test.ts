import { buildLocalPersonQuery } from '@/local-first/utils/buildLocalPersonQuery';

const SYNCED_COLUMNS = [
  'id',
  'nameFirstName',
  'nameLastName',
  'jobTitle',
  'emailsPrimaryEmail',
  'position',
  'createdAt',
  'updatedAt',
  'deletedAt',
];

const SOFT_DELETE_OPT_IN_FILTER = {
  or: [{ deletedAt: { is: 'NULL' } }, { deletedAt: { is: 'NOT_NULL' } }],
};

describe('buildLocalPersonQuery', () => {
  it('should hide soft-deleted rows when no filter is given, matching the API default', () => {
    const result = buildLocalPersonQuery({
      selectColumns: SYNCED_COLUMNS,
      orderableColumns: SYNCED_COLUMNS,
    });

    expect(result).toMatchObject({ isSupported: true });
    if (!result.isSupported) return;
    expect(result.sql).toContain('where "deletedAt" is null');
  });

  it('should treat an empty filter object the same as no filter', () => {
    const result = buildLocalPersonQuery({
      filter: {},
      selectColumns: SYNCED_COLUMNS,
      orderableColumns: SYNCED_COLUMNS,
    });

    expect(result).toMatchObject({ isSupported: true });
    if (!result.isSupported) return;
    expect(result.sql).toContain('where "deletedAt" is null');
  });

  it('should include soft-deleted rows when the query opts in', () => {
    const result = buildLocalPersonQuery({
      selectColumns: SYNCED_COLUMNS,
      orderableColumns: SYNCED_COLUMNS,
      filter: SOFT_DELETE_OPT_IN_FILTER,
    });

    expect(result).toMatchObject({ isSupported: true });
    if (!result.isSupported) return;
    expect(result.sql).not.toContain('where');
  });

  it('should translate the default view ordering', () => {
    const result = buildLocalPersonQuery({
      selectColumns: SYNCED_COLUMNS,
      orderableColumns: SYNCED_COLUMNS,
      orderBy: [{ position: 'AscNullsFirst' }],
      limit: 30,
    });

    expect(result).toMatchObject({ isSupported: true });
    if (!result.isSupported) return;
    expect(result.sql).toContain('order by "position" asc nulls first');
    expect(result.sql).toContain('limit $1');
    expect(result.params).toEqual([30]);
  });

  it('should translate multi-field ordering in order', () => {
    const result = buildLocalPersonQuery({
      selectColumns: SYNCED_COLUMNS,
      orderableColumns: SYNCED_COLUMNS,
      orderBy: [
        { nameLastName: 'DescNullsLast' },
        { position: 'AscNullsFirst' },
      ],
    });

    expect(result).toMatchObject({ isSupported: true });
    if (!result.isSupported) return;
    expect(result.sql).toContain(
      'order by "nameLastName" desc nulls last, "position" asc nulls first',
    );
  });

  it('should number limit and offset params independently', () => {
    const result = buildLocalPersonQuery({
      limit: 30,
      offset: 60,
      selectColumns: SYNCED_COLUMNS,
      orderableColumns: SYNCED_COLUMNS,
    });

    expect(result).toMatchObject({ isSupported: true });
    if (!result.isSupported) return;
    expect(result.sql).toContain('limit $1');
    expect(result.sql).toContain('offset $2');
    expect(result.params).toEqual([30, 60]);
  });

  // Everything below must refuse rather than answer approximately: a wrong
  // local answer is worse than no local answer.
  it('should refuse a filter it cannot express', () => {
    expect(
      buildLocalPersonQuery({
        selectColumns: SYNCED_COLUMNS,
        orderableColumns: SYNCED_COLUMNS,
        filter: { nameFirstName: { ilike: '%mark%' } },
      }),
    ).toEqual({ isSupported: false, reason: 'unsupported filter' });
  });

  it('should refuse a filter that only looks like the soft-delete opt-in', () => {
    expect(
      buildLocalPersonQuery({
        selectColumns: SYNCED_COLUMNS,
        orderableColumns: SYNCED_COLUMNS,
        filter: {
          or: [
            { deletedAt: { is: 'NULL' } },
            { deletedAt: { is: 'NOT_NULL' }, jobTitle: { eq: 'x' } },
          ],
        },
      }),
    ).toEqual({ isSupported: false, reason: 'unsupported filter' });
  });

  it('should refuse ordering by a field that is not synced', () => {
    expect(
      buildLocalPersonQuery({
        orderBy: [{ city: 'AscNullsLast' }],
        selectColumns: SYNCED_COLUMNS,
        orderableColumns: SYNCED_COLUMNS,
      }),
    ).toEqual({
      isSupported: false,
      reason: 'orderBy on unsynced field "city"',
    });
  });

  it('should refuse ordering by a composite subfield or relation', () => {
    expect(
      buildLocalPersonQuery({
        selectColumns: SYNCED_COLUMNS,
        orderableColumns: SYNCED_COLUMNS,
        orderBy: [{ company: { name: 'AscNullsLast' } }],
      }),
    ).toMatchObject({ isSupported: false });
  });

  it('should refuse an unknown order direction', () => {
    expect(
      buildLocalPersonQuery({
        orderBy: [{ position: 'Sideways' }],
        selectColumns: SYNCED_COLUMNS,
        orderableColumns: SYNCED_COLUMNS,
      }),
    ).toEqual({
      isSupported: false,
      reason: 'unknown orderBy direction "Sideways"',
    });
  });

  it('should refuse cursor pagination', () => {
    expect(
      buildLocalPersonQuery({
        selectColumns: SYNCED_COLUMNS,
        orderableColumns: SYNCED_COLUMNS,
        cursorFilter: { cursor: 'abc', cursorDirection: 'after' },
      }),
    ).toEqual({ isSupported: false, reason: 'cursor pagination' });
  });

  it('should refuse a non-integer limit', () => {
    expect(
      buildLocalPersonQuery({
        limit: 'all',
        selectColumns: SYNCED_COLUMNS,
        orderableColumns: SYNCED_COLUMNS,
      }),
    ).toEqual({
      isSupported: false,
      reason: 'non-integer limit',
    });
  });
});
