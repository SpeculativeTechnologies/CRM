import { createHash } from 'crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  FieldMetadataType,
  type LocalFirstChange,
  type LocalFirstChangeResult,
  type LocalFirstValue,
} from 'twenty-shared/types';

import { CommonFindOneQueryRunnerService } from 'src/engine/api/common/common-query-runners/common-find-one-query-runner.service';
import { CommonUpdateOneQueryRunnerService } from 'src/engine/api/common/common-query-runners/common-update-one-query-runner.service';
import { isUserAuthContext } from 'src/engine/core-modules/auth/guards/is-user-auth-context.guard';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { parseLocalFirstChange } from 'src/engine/core-modules/local-first/utils/parse-local-first-change.util';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { findFlatEntityByIdInFlatEntityMapsOrThrow } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps-or-throw.util';
import { getWorkspaceContext } from 'src/engine/twenty-orm/storage/orm-workspace-context.storage';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { computeObjectTargetTable } from 'src/engine/utils/compute-object-target-table.util';
import { escapeIdentifier } from 'src/engine/workspace-manager/workspace-migration/utils/remove-sql-injection.util';

const SUPPORTED_TYPES = new Set([
  FieldMetadataType.TEXT,
  FieldMetadataType.NUMBER,
  FieldMetadataType.BOOLEAN,
  FieldMetadataType.SELECT,
]);

@Injectable()
export class LocalFirstChangeService {
  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly findOne: CommonFindOneQueryRunnerService,
    private readonly updateOne: CommonUpdateOneQueryRunnerService,
  ) {}

  async apply(
    input: unknown,
    authContext: WorkspaceAuthContext,
    expectedScope: {
      userId: string | undefined;
      workspaceId: string | undefined;
    },
  ): Promise<LocalFirstChangeResult> {
    if (!this.twentyConfigService.get('IS_LOCAL_FIRST_WRITES_ENABLED')) {
      throw new NotFoundException('Experimental local edits are disabled');
    }
    if (!isUserAuthContext(authContext)) {
      throw new ForbiddenException('Local edits require a workspace member');
    }
    // Cookies can change in another tab before the old tab's local identity
    // updates. Never apply an old account's journal as the newly signed-in user.
    if (
      expectedScope.userId !== authContext.user.id ||
      expectedScope.workspaceId !== authContext.workspace.id
    ) {
      throw new ForbiddenException('The local edit belongs to another session');
    }

    const change = parseLocalFirstChange(input);
    const userId = authContext.user.id;
    const workspaceId = authContext.workspace.id;
    const requestHash = createHash('sha256')
      .update(JSON.stringify(change))
      .digest('hex');

    return this.workspaceOrmManager.executeInWorkspaceContext(
      () =>
        this.workspaceOrmManager.runInWorkspaceTransaction(
          async (transactionScope) => {
            // Serialize retries even when they arrive in different browser tabs.
            await transactionScope.executeRawQuery(
              'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
              [JSON.stringify([workspaceId, userId, change.operationId])],
            );
            const receipts = await transactionScope.executeRawQuery(
              'SELECT "requestHash", "workspaceId" FROM core."localFirstOperation" WHERE "operationId" = $1 AND "userId" = $2',
              [change.operationId, userId],
            );
            if (receipts.length > 0) {
              if (
                receipts[0].requestHash !== requestHash ||
                receipts[0].workspaceId !== workspaceId
              ) {
                throw new ConflictException(
                  'An operation ID cannot be reused for a different change',
                );
              }
              // A receipt contains no record values, including after permissions change.
              return {
                status: 'applied' as const,
                operationId: change.operationId,
              };
            }

            const result = await this.applyInTransaction(
              change,
              authContext,
              transactionScope,
            );
            if (result.status === 'applied') {
              await transactionScope.executeRawQuery(
                'INSERT INTO core."localFirstOperation" ("operationId", "userId", "workspaceId", "requestHash") VALUES ($1, $2, $3, $4)',
                [change.operationId, userId, workspaceId, requestHash],
              );
            }
            return result;
          },
        ),
      authContext,
    );
  }

  private async applyInTransaction(
    change: LocalFirstChange,
    authContext: WorkspaceAuthContext,
    transactionScope: WorkspaceTransactionScope,
  ): Promise<LocalFirstChangeResult> {
    const context = getWorkspaceContext();
    const flatObjectMetadata = findFlatEntityByIdInFlatEntityMapsOrThrow({
      flatEntityId: change.objectId,
      flatEntityMaps: context.flatObjectMetadataMaps,
    });
    if (flatObjectMetadata.isSystem || flatObjectMetadata.isRemote) {
      throw new BadRequestException('This object does not support local edits');
    }
    const fields = change.changes.map((fieldChange) => {
      const field = findFlatEntityByIdInFlatEntityMapsOrThrow({
        flatEntityId: fieldChange.fieldId,
        flatEntityMaps: context.flatFieldMetadataMaps,
      });
      if (
        field.objectMetadataId !== change.objectId ||
        field.isSystem ||
        !field.isActive ||
        !SUPPORTED_TYPES.has(field.type)
      ) {
        throw new BadRequestException(
          'This field does not support local edits',
        );
      }
      return { field, fieldChange };
    });
    const queryContext = { ...context, flatObjectMetadata, transactionScope };
    const selectedFields = Object.fromEntries(
      ['id', ...fields.map(({ field }) => field.name)].map((name) => [
        name,
        {},
      ]),
    );

    // Every writer takes PostgreSQL row locks. Lock before reading the base so
    // an ordinary online update cannot slip between comparison and mutation.
    const schema = authContext.workspace.databaseSchema;
    if (!schema)
      throw new NotFoundException('Workspace storage is unavailable');
    await transactionScope.executeRawQuery(
      `SELECT id FROM ${escapeIdentifier(schema)}.${escapeIdentifier(computeObjectTargetTable(flatObjectMetadata))} WHERE id = $1 FOR UPDATE`,
      [change.recordId],
    );
    // Common runners enforce object, field, row permissions and input validation.
    const { results: record } = await this.findOne.execute(
      { filter: { id: { eq: change.recordId } }, selectedFields },
      queryContext,
    );
    const current = Object.fromEntries(
      fields.map(({ field, fieldChange }) => [
        fieldChange.fieldId,
        record[field.name] as LocalFirstValue,
      ]),
    );
    if (
      fields.some(
        ({ fieldChange }) =>
          current[fieldChange.fieldId] !== fieldChange.before,
      )
    ) {
      return { status: 'conflict', operationId: change.operationId, current };
    }
    await this.updateOne.execute(
      {
        id: change.recordId,
        data: Object.fromEntries(
          fields.map(({ field, fieldChange }) => [
            field.name,
            fieldChange.after,
          ]),
        ),
        selectedFields: { id: {} },
      },
      queryContext,
    );
    return { status: 'applied', operationId: change.operationId };
  }
}
