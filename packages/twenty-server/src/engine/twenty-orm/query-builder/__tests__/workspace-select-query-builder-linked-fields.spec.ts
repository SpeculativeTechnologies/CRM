import { WorkspaceSelectQueryBuilder } from 'src/engine/twenty-orm/query-builder/workspace-select-query-builder';
import {
  buildColumn,
  companyTableShape,
  personTableShape,
} from 'src/engine/twenty-orm/query-builder/__tests__/workspace-select-query-builder-test-shapes.util';
import { type WorkspaceTableShape } from 'src/engine/twenty-orm/table-shape/types/workspace-table-shape.type';
import { buildInsertStatement } from 'src/engine/twenty-orm/sql/utils/build-insert-statement.util';
import { type CompiledStatement } from 'src/engine/twenty-orm/sql/utils/compile-named-parameters.util';

const linkedCompany: WorkspaceTableShape = {
  ...companyTableShape,
  columnNames: [
    ...companyTableShape.columnNames,
    'personId',
    'personFirstName',
  ],
  columnShapeByColumnName: {
    ...companyTableShape.columnShapeByColumnName,
    personId: buildColumn('personId'),
    personFirstName: {
      ...buildColumn('personFirstName'),
      linkedColumn: {
        relationFieldName: 'person',
        sourceColumnName: 'nameFirstName',
      },
    },
  },
};

const buildLinkedQuery = ({
  rows = [],
  checkPermissions = () => undefined,
  tableShape = linkedCompany,
}: {
  rows?: Record<string, unknown>[];
  checkPermissions?: (query: WorkspaceSelectQueryBuilder) => void;
  tableShape?: WorkspaceTableShape;
} = {}) => {
  const execute = jest.fn(async (_statement: CompiledStatement) => rows);
  const query = new WorkspaceSelectQueryBuilder('record', {
    tableShape,
    executor: { execute },
    objectRecordsPermissions: {},
    tableShapeByObjectMetadataId: (id) =>
      id === personTableShape.objectMetadataId
        ? personTableShape
        : linkedCompany,
    onBeforeExecute: checkPermissions,
    formatResult: (records) => records as never,
  });
  return { query, execute };
};

describe('linked field queries', () => {
  it('reads the source with a left join and preserves destination hydration aliases', async () => {
    const { query } = buildLinkedQuery({
      rows: [{ record_id: 'one', record_personFirstName: 'Ada' }],
    });
    query.select(['id', 'personFirstName']);
    expect(query.getQuery()).toContain(
      '"__linked_0"."nameFirstName" AS "record_personFirstName"',
    );
    expect(query.getQuery()).toContain('LEFT JOIN');
    expect(query.getQuery()).toContain(
      '"record"."personId" = "__linked_0"."id"',
    );
    expect(await query.getMany()).toEqual([
      { id: 'one', personFirstName: 'Ada' },
    ]);
  });

  it('keeps source row permissions in the join so an inaccessible Person gives a null value', () => {
    const { query } = buildLinkedQuery({
      checkPermissions: (builder) => {
        for (const join of builder.getJoinAliases()) {
          if (builder.markRowLevelPermissionApplied(join.name)) {
            builder.addJoinCondition(
              join.name,
              `"${join.name}"."companyId" = :allowedCompany`,
            );
            builder.setParameter('allowedCompany', 'allowed');
          }
        }
      },
    });
    const [sql, parameters] = query.getQueryAndParameters();
    expect(sql).toContain('("__linked_0"."companyId" = $1)');
    expect(sql).toContain('("__linked_0"."deletedAt" IS NULL)');
    expect(parameters).toEqual(['allowed']);
    expect(sql).not.toContain('"record"."personFirstName"');
  });

  it('keeps deleted sources empty when a mutation response includes deleted destination records', () => {
    const { query } = buildLinkedQuery();
    const sql = query
      .select(['id', 'personFirstName'])
      .withDeleted()
      .getQuery();
    expect(sql).toContain('"__linked_0"."deletedAt" IS NULL');
    expect(sql).not.toContain('"record"."deletedAt" IS NULL');
  });

  it('checks source and relationship permissions for a filter-only reference', () => {
    const { query } = buildLinkedQuery({
      checkPermissions: (builder) => {
        const columns = builder.getReferencedColumnNamesByAlias();
        expect(columns.record).toEqual(
          expect.arrayContaining(['personFirstName', 'personId']),
        );
        expect(columns.__linked_0).toContain('nameFirstName');
        throw new Error('Source field permission denied');
      },
    });
    query.select(['id']).where({ personFirstName: 'Ada' });
    expect(() => query.getQuery()).toThrow('Source field permission denied');
  });

  it('resolves filtering, ordering, grouping, aggregates and counts against the source', async () => {
    const { query, execute } = buildLinkedQuery({ rows: [{ count: '2' }] });
    query
      .select([])
      .addSelect('COUNT(record.personFirstName)', 'count')
      .where({ personFirstName: 'Ada' })
      .groupBy('record.personFirstName')
      .orderBy('record.personFirstName', 'DESC');
    const sql = query.getQuery();
    expect(sql).toContain('COUNT("__linked_0"."nameFirstName")');
    expect(sql).toContain('GROUP BY "__linked_0"."nameFirstName"');
    expect(sql).toContain('ORDER BY "__linked_0"."nameFirstName" DESC');
    expect(await query.getCount()).toBe(2);
    expect(execute.mock.calls[0][0].text).toContain(
      '"__linked_0"."nameFirstName" = $1',
    );
  });

  it('does not join or require a source for an ordinary id query or count', async () => {
    const { query, execute } = buildLinkedQuery({ rows: [{ count: '1' }] });
    expect(query.select(['id']).getQuery()).not.toContain('JOIN');
    await query.getCount();
    expect(execute.mock.calls[0][0].text).not.toContain('JOIN');
  });

  it('keeps linked joins inside the scope of nested relation filters', () => {
    const { query } = buildLinkedQuery({ tableShape: personTableShape });
    query.select(['id']).where({ company: { personFirstName: 'Ada' } });
    const sql = query.getQuery();
    expect(sql).toMatch(
      /EXISTS \(SELECT 1 FROM .* AS "record_company_filter" LEFT JOIN/,
    );
    expect(sql).toContain(
      '"record_company_filter"."personId" = "__linked_0"."id"',
    );
    expect(sql).toContain('"__linked_0"."nameFirstName" =');
  });

  it('filters bulk mutations through the permission-checked selection', () => {
    const { query } = buildLinkedQuery();
    const sql = query
      .where({ personFirstName: 'Ada' })
      .update()
      .set({ name: 'Updated' })
      .returning(['id', 'personFirstName'])
      .getQuery();
    expect(sql).toContain('"record"."id" IN (SELECT');
    expect(sql).toContain('"__linked_0"."nameFirstName" =');
    expect(sql.split('RETURNING')[1]).not.toContain('personFirstName');
  });

  it('rejects writes to linked fields even through the raw mutation builder', () => {
    const { query } = buildLinkedQuery();
    expect(() =>
      query.update().set({ personFirstName: 'Overwrite' }).getQuery(),
    ).toThrow('read-only');
    expect(() =>
      buildInsertStatement({
        tableShape: linkedCompany,
        columnNames: ['personFirstName'],
        returningColumns: ['id'],
        rows: [[{ kind: 'parameter', parameterName: 'value' }]],
      }),
    ).toThrow('read-only');
  });
});
