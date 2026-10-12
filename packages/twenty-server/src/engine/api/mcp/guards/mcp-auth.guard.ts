import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { type Request, type Response } from 'express';

import {
  DEFAULT_OAUTH_SCOPES,
  OAUTH_SCOPES,
} from 'src/engine/core-modules/application/application-oauth/constants/oauth-scopes';
import { MCP_READ_ONLY_PATH } from 'src/engine/api/mcp/constants/mcp-read-only-path.const';
import { ApplicationAuthorizationService } from 'src/engine/core-modules/application/application-authorization/services/application-authorization.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

// RFC 9728 / MCP authorization spec: when the MCP endpoint returns 401,
// include a WWW-Authenticate header pointing to the path-aware Protected
// Resource Metadata URL so the client discovers the correct resource
// identifier. The `scope` parameter tells the client which scopes to request.
@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly applicationAuthorizationService: ApplicationAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const isReadOnly =
      request.path?.toLowerCase().replace(/\/$/, '') === MCP_READ_ONLY_PATH;
    let isAuthenticated = await this.jwtAuthGuard.canActivate(context);

    if (isAuthenticated && isReadOnly) {
      isAuthenticated = false;

      if (
        request.mcpReadOnlyResource &&
        request.user?.id &&
        request.application?.id
      ) {
        const authorization =
          await this.applicationAuthorizationService.findByUserAndApplication({
            userId: request.user.id,
            applicationId: request.application.id,
          });

        isAuthenticated =
          authorization?.workspaceId === request.workspace?.id &&
          authorization?.revokedAt === null &&
          authorization.scopes?.includes(OAUTH_SCOPES.MCP_READ_ONLY) === true;
      }
    }

    if (!isAuthenticated) {
      const baseUrl = `${request.protocol}://${request.get('host')}`;
      const resourceMetadataUrl = `${baseUrl}/.well-known/oauth-protected-resource${isReadOnly ? MCP_READ_ONLY_PATH : '/mcp'}`;
      const scope = isReadOnly
        ? OAUTH_SCOPES.MCP_READ_ONLY
        : DEFAULT_OAUTH_SCOPES.join(' ');

      // Set the header on the response before throwing, because exception
      // filters may not preserve custom headers from the exception payload.
      const response = context.switchToHttp().getResponse<Response>();

      response.setHeader(
        'WWW-Authenticate',
        `Bearer resource_metadata="${resourceMetadataUrl}", scope="${scope}"`,
      );

      throw new UnauthorizedException();
    }

    return true;
  }
}
