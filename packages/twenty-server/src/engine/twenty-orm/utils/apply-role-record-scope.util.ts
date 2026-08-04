import { type ObjectsPermissions } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { Brackets, type ObjectLiteral } from 'typeorm';

import { GraphqlQueryFilterConditionParser } from 'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query-filter/graphql-query-filter-condition.parser';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type WorkspaceInternalContext } from 'src/engine/twenty-orm/interfaces/workspace-internal-context.interface';
import { type WorkspaceSelectQueryBuilder } from 'src/engine/twenty-orm/repository/workspace-select-query-builder';

type ApplyRoleRecordScopeArgs<T extends ObjectLiteral> = {
  queryBuilder: WorkspaceSelectQueryBuilder<T>;
  objectMetadata: FlatObjectMetadata;
  objectRecordsPermissions: ObjectsPermissions;
  internalContext: WorkspaceInternalContext;
  // UPDATE and DELETE statements have no alias to qualify columns with
  useDirectTableReference?: boolean;
};

// Narrows a query to the records the current role is scoped to, by ANDing the
// role's stored filter into the WHERE clause. Applied on reads and writes
// alike, so an out-of-scope record can be neither seen nor modified.
export const applyRoleRecordScope = <T extends ObjectLiteral>({
  queryBuilder,
  objectMetadata,
  objectRecordsPermissions,
  internalContext,
  useDirectTableReference = false,
}: ApplyRoleRecordScopeArgs<T>): void => {
  const recordScopeFilter =
    objectRecordsPermissions[objectMetadata.id]?.recordScopeFilter;

  if (
    !isDefined(recordScopeFilter) ||
    Object.keys(recordScopeFilter).length === 0
  ) {
    return;
  }

  const conditionParser = new GraphqlQueryFilterConditionParser(
    objectMetadata,
    internalContext.flatFieldMetadataMaps,
    internalContext.flatObjectMetadataMaps,
  );

  const scopeCondition = new Brackets((whereExpressionBuilder) => {
    conditionParser.applyFilterEntriesToWhereBrackets(
      whereExpressionBuilder,
      queryBuilder as unknown as WorkspaceSelectQueryBuilder<ObjectLiteral>,
      objectMetadata.nameSingular,
      recordScopeFilter,
      useDirectTableReference,
    );
  });

  if (queryBuilder.expressionMap.wheres.length === 0) {
    queryBuilder.where(scopeCondition);
  } else {
    queryBuilder.andWhere(scopeCondition);
  }
};
