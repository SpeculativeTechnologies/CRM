import { MCP_READ_ONLY_PATH } from 'src/engine/api/mcp/constants/mcp-read-only-path.const';
import { OAUTH_SCOPES } from 'src/engine/core-modules/application/application-oauth/constants/oauth-scopes';
import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { assertIssuerIsPublishedOrThrow } from 'src/engine/core-modules/auth/utils/assert-issuer-is-published.util';

export const getReadOnlyMcpAuthorizationContext = ({
  scopes,
  resource,
  requestBaseUrl,
  serverUrl,
}: {
  scopes: string[];
  resource?: string;
  requestBaseUrl: string;
  serverUrl?: string;
}): { mcpReadOnlyResource?: string } => {
  if (!scopes.includes(OAUTH_SCOPES.MCP_READ_ONLY)) {
    return {};
  }

  if (
    scopes.includes(OAUTH_SCOPES.API) ||
    !resource?.endsWith(MCP_READ_ONLY_PATH)
  ) {
    throw new AuthException(
      'Read-only MCP authorization requires its resource and cannot grant API access',
      AuthExceptionCode.FORBIDDEN_EXCEPTION,
    );
  }

  assertIssuerIsPublishedOrThrow({
    issuer: resource,
    requestBaseUrl,
    serverUrl,
  });

  return { mcpReadOnlyResource: resource };
};
