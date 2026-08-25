import { type ObjectLiteral } from 'typeorm';
import { type FeatureFlagKey } from 'twenty-shared/types';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type CommonBaseQueryRunnerContext } from 'src/engine/api/common/types/common-base-query-runner-context.type';
import { type GraphqlQueryParser } from 'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query.parser';
import { type GlobalWorkspaceDataSource } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-datasource';
import { type WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace.repository';
import { type RolePermissionConfig } from 'src/engine/twenty-orm/types/role-permission-config';

export type CommonExtendedQueryRunnerContext = Omit<
  CommonBaseQueryRunnerContext,
  'authContext'
> & {
  authContext: WorkspaceAuthContext;
  // Fork: the TypeORM data source stays available for paths that still need
  // v1 transactions (person merge) and for record label formula recomputes.
  workspaceDataSource: GlobalWorkspaceDataSource;
  rolePermissionConfig: RolePermissionConfig;
  repository: WorkspaceRepository<ObjectLiteral>;
  commonQueryParser: GraphqlQueryParser;
  featureFlagsMap: Record<FeatureFlagKey, boolean>;
};
