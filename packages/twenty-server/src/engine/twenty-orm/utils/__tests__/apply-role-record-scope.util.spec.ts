import { type ObjectsPermissions } from 'twenty-shared/types';

import { GraphqlQueryFilterConditionParser } from 'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query-filter/graphql-query-filter-condition.parser';
import { type WorkspaceInternalContext } from 'src/engine/twenty-orm/interfaces/workspace-internal-context.interface';
import { applyRoleRecordScope } from 'src/engine/twenty-orm/utils/apply-role-record-scope.util';

jest.mock(
  'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query-filter/graphql-query-filter-condition.parser',
);

const OBJECT_METADATA_ID = 'e21891ca-c911-495a-9dc9-eb0943511d02';

const objectMetadata = {
  id: OBJECT_METADATA_ID,
  nameSingular: 'opportunity',
  // oxlint-disable-next-line typescript/no-explicit-any
} as any;

const internalContext = {
  flatFieldMetadataMaps: {},
  flatObjectMetadataMaps: {},
} as unknown as WorkspaceInternalContext;

const buildPermissions = (
  recordScopeFilter: ObjectsPermissions[string]['recordScopeFilter'],
): ObjectsPermissions => ({
  [OBJECT_METADATA_ID]: {
    canReadObjectRecords: true,
    canUpdateObjectRecords: true,
    canSoftDeleteObjectRecords: true,
    canDestroyObjectRecords: true,
    restrictedFields: {},
    rowLevelPermissionPredicates: [],
    rowLevelPermissionPredicateGroups: [],
    recordScopeFilter,
  },
});

const buildQueryBuilder = (existingWheres: unknown[] = []) => {
  const queryBuilder = {
    expressionMap: { wheres: existingWheres },
    where: jest.fn(),
    andWhere: jest.fn(),
  };

  // oxlint-disable-next-line typescript/no-explicit-any
  return queryBuilder as any;
};

describe('applyRoleRecordScope', () => {
  let applyFilterEntriesToWhereBrackets: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    applyFilterEntriesToWhereBrackets = jest.fn();
    (
      GraphqlQueryFilterConditionParser as unknown as jest.Mock
    ).mockImplementation(() => ({
      applyFilterEntriesToWhereBrackets,
    }));
  });

  it('should not touch the query when the role has no record scope', () => {
    const queryBuilder = buildQueryBuilder();

    applyRoleRecordScope({
      queryBuilder,
      objectMetadata,
      objectRecordsPermissions: buildPermissions(null),
      internalContext,
    });

    expect(queryBuilder.where).not.toHaveBeenCalled();
    expect(queryBuilder.andWhere).not.toHaveBeenCalled();
  });

  it('should not touch the query when the scope filter is an empty object', () => {
    const queryBuilder = buildQueryBuilder();

    applyRoleRecordScope({
      queryBuilder,
      objectMetadata,
      objectRecordsPermissions: buildPermissions({}),
      internalContext,
    });

    expect(queryBuilder.where).not.toHaveBeenCalled();
    expect(queryBuilder.andWhere).not.toHaveBeenCalled();
  });

  it('should not touch the query when the object has no permissions entry', () => {
    const queryBuilder = buildQueryBuilder();

    applyRoleRecordScope({
      queryBuilder,
      objectMetadata,
      objectRecordsPermissions: {},
      internalContext,
    });

    expect(queryBuilder.where).not.toHaveBeenCalled();
    expect(queryBuilder.andWhere).not.toHaveBeenCalled();
  });

  it('should set the where clause when the query has none yet', () => {
    const queryBuilder = buildQueryBuilder();

    applyRoleRecordScope({
      queryBuilder,
      objectMetadata,
      objectRecordsPermissions: buildPermissions({
        pipeline: { in: ['VN_LAB'] },
      }),
      internalContext,
    });

    expect(queryBuilder.where).toHaveBeenCalledTimes(1);
    expect(queryBuilder.andWhere).not.toHaveBeenCalled();
  });

  it('should AND onto an existing where clause so a caller filter cannot widen the scope', () => {
    const queryBuilder = buildQueryBuilder(['existing-where']);

    applyRoleRecordScope({
      queryBuilder,
      objectMetadata,
      objectRecordsPermissions: buildPermissions({
        pipeline: { in: ['VN_LAB'] },
      }),
      internalContext,
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledTimes(1);
    expect(queryBuilder.where).not.toHaveBeenCalled();
  });

  it('should pass the scope filter to the condition parser', () => {
    const queryBuilder = buildQueryBuilder();
    const recordScopeFilter = {
      pipeline: { in: ['VN_MANUFACTURING', 'VN_LAB'] },
    };

    applyRoleRecordScope({
      queryBuilder,
      objectMetadata,
      objectRecordsPermissions: buildPermissions(recordScopeFilter),
      internalContext,
    });

    // The Brackets callback is what actually invokes the parser
    const bracketsArgument = queryBuilder.where.mock.calls[0][0];

    bracketsArgument.whereFactory({});

    expect(applyFilterEntriesToWhereBrackets).toHaveBeenCalledWith(
      expect.anything(),
      queryBuilder,
      'opportunity',
      recordScopeFilter,
      false,
    );
  });

  it('should request direct table references for update and delete statements', () => {
    const queryBuilder = buildQueryBuilder();
    const recordScopeFilter = { pipeline: { in: ['VN_LAB'] } };

    applyRoleRecordScope({
      queryBuilder,
      objectMetadata,
      objectRecordsPermissions: buildPermissions(recordScopeFilter),
      internalContext,
      useDirectTableReference: true,
    });

    const bracketsArgument = queryBuilder.where.mock.calls[0][0];

    bracketsArgument.whereFactory({});

    expect(applyFilterEntriesToWhereBrackets).toHaveBeenCalledWith(
      expect.anything(),
      queryBuilder,
      'opportunity',
      recordScopeFilter,
      true,
    );
  });
});
