import { buildLocalReadPlan } from '@/local-first/utils/buildLocalReadPlan';
import { type RequestedNodeField } from '@/local-first/utils/extractRequestedNodeFields';

const COLUMNS_BY_TABLE = {
  person: [
    'id',
    'nameFirstName',
    'nameLastName',
    'jobTitle',
    'avatarFile',
    'companyId',
    'position',
    'deletedAt',
  ],
  company: ['id', 'name', 'deletedAt'],
  _employmentHistory: ['id', 'personId', 'companyId', 'deletedAt'],
};

const scalar = (name: string): RequestedNodeField => ({
  name,
  subFields: [],
  relation: null,
});

describe('buildLocalReadPlan', () => {
  it('should plan scalars and flattened composites', () => {
    const result = buildLocalReadPlan({
      table: 'person',
      requestedFields: [
        scalar('id'),
        { name: 'name', subFields: ['firstName', 'lastName'], relation: null },
      ],
      columnsByTable: COLUMNS_BY_TABLE,
    });

    expect(result.isSupported).toBe(true);
    if (!result.isSupported) return;
    expect(result.plan.columns).toEqual(
      expect.arrayContaining(['id', 'nameFirstName', 'nameLastName']),
    );
    expect(result.plan.compositeFields[0].subFields[0].source).toEqual({
      column: 'nameFirstName',
      jsonKey: null,
    });
  });

  // avatarFile is a single jsonb column exposed as a composite, unlike name.
  it('should plan a composite held inside a jsonb column', () => {
    const result = buildLocalReadPlan({
      table: 'person',
      requestedFields: [
        { name: 'avatarFile', subFields: ['url'], relation: null },
      ],
      columnsByTable: COLUMNS_BY_TABLE,
    });

    expect(result.isSupported).toBe(true);
    if (!result.isSupported) return;
    expect(result.plan.compositeFields[0].subFields[0].source).toEqual({
      column: 'avatarFile',
      jsonKey: 'url',
    });
  });

  it('should plan a to-one relation and select its foreign key', () => {
    const result = buildLocalReadPlan({
      table: 'person',
      requestedFields: [
        {
          name: 'company',
          subFields: [],
          relation: {
            kind: 'toOne',
            nodeFields: [scalar('id'), scalar('name')],
          },
        },
      ],
      columnsByTable: COLUMNS_BY_TABLE,
    });

    expect(result.isSupported).toBe(true);
    if (!result.isSupported) return;
    expect(result.plan.columns).toContain('companyId');
    expect(result.plan.relations[0].plan.table).toBe('company');
  });

  // Twenty models many-to-many through a join object, so this is one-to-many
  // onto the join table.
  it('should plan a to-many relation onto its join table', () => {
    const result = buildLocalReadPlan({
      table: 'person',
      requestedFields: [
        {
          name: 'previousCompanies',
          subFields: [],
          relation: { kind: 'toMany', nodeFields: [scalar('id')] },
        },
      ],
      columnsByTable: COLUMNS_BY_TABLE,
    });

    expect(result.isSupported).toBe(true);
    if (!result.isSupported) return;
    expect(result.plan.relations[0].source).toMatchObject({
      kind: 'toMany',
      targetTable: '_employmentHistory',
      targetForeignKeyColumn: 'personId',
    });
  });

  // Everything below must refuse: a plan that guessed would serve wrong rows.
  it('should refuse a field that is not mirrored', () => {
    expect(
      buildLocalReadPlan({
        table: 'person',
        requestedFields: [scalar('intro')],
        columnsByTable: COLUMNS_BY_TABLE,
      }),
    ).toEqual({ isSupported: false, reason: 'intro is not mirrored' });
  });

  it('should refuse a relation it does not know', () => {
    expect(
      buildLocalReadPlan({
        table: 'person',
        requestedFields: [
          {
            name: 'opportunities',
            subFields: [],
            relation: { kind: 'toMany', nodeFields: [scalar('id')] },
          },
        ],
        columnsByTable: COLUMNS_BY_TABLE,
      }),
    ).toEqual({
      isSupported: false,
      reason: 'opportunities is an unknown relation',
    });
  });

  it('should refuse when a relation target table is not mirrored', () => {
    expect(
      buildLocalReadPlan({
        table: 'person',
        requestedFields: [
          {
            name: 'caredForPets',
            subFields: [],
            relation: { kind: 'toMany', nodeFields: [scalar('id')] },
          },
        ],
        columnsByTable: COLUMNS_BY_TABLE,
      }),
    ).toMatchObject({ isSupported: false });
  });

  it('should refuse a table that is not mirrored', () => {
    expect(
      buildLocalReadPlan({
        table: 'opportunity',
        requestedFields: [scalar('id')],
        columnsByTable: COLUMNS_BY_TABLE,
      }),
    ).toEqual({
      isSupported: false,
      reason: 'table "opportunity" is not mirrored',
    });
  });

  it('should refuse a query with no parsed fields', () => {
    expect(
      buildLocalReadPlan({
        table: 'person',
        requestedFields: [],
        columnsByTable: COLUMNS_BY_TABLE,
      }),
    ).toEqual({
      isSupported: false,
      reason: 'no fields parsed from the query',
    });
  });
});
