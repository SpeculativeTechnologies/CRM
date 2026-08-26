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
  ) {}

  // Electric shape subscription scoped to the caller's workspace: the schema
  // comes from the authenticated workspace, never from the client. No
  // per-role permission check yet: the whitelist is limited to benign person
  // columns, and role-based object/field filtering is tracked in the
  // local-first NOTES.md before any wider coverage.
  @Get('shape/:tableName')
  @UseGuards(NoPermissionGuard)
  async getShape(
    @Param('tableName') tableName: string,
    @Query() query: Record<string, string | undefined>,
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Res() response: Response,
  ): Promise<void> {
    if (!isNonEmptyString(workspace.databaseSchema)) {
      throw new NotFoundException(
        'Workspace has no database schema to sync from',
      );
    }

    await this.localFirstShapeProxyService.proxyShapeRequest({
      tableName,
      workspaceSchema: workspace.databaseSchema,
      query,
      response,
    });
  }
}
