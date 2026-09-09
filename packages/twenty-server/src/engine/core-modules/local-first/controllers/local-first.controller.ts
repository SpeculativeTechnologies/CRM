import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  ForbiddenException,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type Response } from 'express';
import { ApiPath } from 'twenty-shared/types';

import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { LocalFirstChangeService } from 'src/engine/core-modules/local-first/services/local-first-change.service';
import { CustomPermissionGuard } from 'src/engine/guards/custom-permission.guard';
import { CommonQueryRunnerException } from 'src/engine/api/common/common-query-runners/errors/common-query-runner.exception';
import { commonQueryRunnerToRestApiExceptionHandler } from 'src/engine/api/common/common-query-runners/utils/common-query-runner-to-rest-api-exception-handler.util';
import { PermissionsException } from 'src/engine/metadata-modules/permissions/permissions.exception';
import { FlatEntityMapsException } from 'src/engine/metadata-modules/flat-entity/exceptions/flat-entity-maps.exception';
import { TwentyOrmException } from 'src/engine/twenty-orm/exceptions/twenty-orm.exception';
import { isTwentyOrmUserInputError } from 'src/engine/twenty-orm/utils/is-twenty-orm-user-input-error.util';

import {
  type LocalFirstColumn,
  LocalFirstSchemaService,
} from 'src/engine/core-modules/local-first/services/local-first-schema.service';
import { LocalFirstShapeProxyService } from 'src/engine/core-modules/local-first/services/local-first-shape-proxy.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@Controller(ApiPath.LocalFirst)
@UseGuards(WorkspaceAuthGuard)
export class LocalFirstController {
  constructor(
    private readonly localFirstShapeProxyService: LocalFirstShapeProxyService,
    private readonly localFirstSchemaService: LocalFirstSchemaService,
    private readonly localFirstChangeService: LocalFirstChangeService,
  ) {}

  @Post('changes')
  @UseGuards(CustomPermissionGuard)
  async applyChange(
    @Body() input: unknown,
    @Headers('x-twenty-local-user-id') userId: string | undefined,
    @Headers('x-twenty-local-workspace-id') workspaceId: string | undefined,
  ) {
    try {
      return await this.localFirstChangeService.apply(
        input,
        getWorkspaceAuthContext(),
        { userId, workspaceId },
      );
    } catch (error) {
      if (error instanceof CommonQueryRunnerException)
        return commonQueryRunnerToRestApiExceptionHandler(error);
      if (error instanceof PermissionsException)
        throw new ForbiddenException('This edit is not permitted');
      if (
        error instanceof FlatEntityMapsException ||
        (error instanceof TwentyOrmException &&
          isTwentyOrmUserInputError(error))
      ) {
        throw new BadRequestException(
          'This edit no longer matches the workspace schema or permissions',
        );
      }
      throw error;
    }
  }

  private getWorkspaceSchema(workspace: WorkspaceEntity): string {
    if (!isNonEmptyString(workspace.databaseSchema)) {
      throw new NotFoundException(
        'Workspace has no database schema to sync from',
      );
    }

    return workspace.databaseSchema;
  }

  // The columns of a syncable table, so a device can build its local mirror
  // before syncing. Same workspace scoping as the shape route.
  @Get('schema/:tableName')
  @UseGuards(NoPermissionGuard)
  async getSchema(
    @Param('tableName') tableName: string,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<{ columns: LocalFirstColumn[] }> {
    const columns = await this.localFirstSchemaService.getSyncableColumns({
      workspaceSchema: this.getWorkspaceSchema(workspace),
      tableName,
    });

    return { columns };
  }

  // Electric shape subscription scoped to the caller's workspace: the schema
  // comes from the authenticated workspace, never from the client. No
  // per-role permission check yet: this syncs every non-generated column of a
  // syncable table, so role-based object/field filtering is a prerequisite
  // before enabling it for more than one role (tracked in NOTES.md).
  @Get('shape/:tableName')
  @UseGuards(NoPermissionGuard)
  async getShape(
    @Param('tableName') tableName: string,
    @Query() query: Record<string, string | undefined>,
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Res() response: Response,
  ): Promise<void> {
    await this.localFirstShapeProxyService.proxyShapeRequest({
      tableName,
      workspaceSchema: this.getWorkspaceSchema(workspace),
      query,
      response,
    });
  }
}
