import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type Response } from 'express';
import { ApiPath } from 'twenty-shared/types';

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
  ) {}

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
