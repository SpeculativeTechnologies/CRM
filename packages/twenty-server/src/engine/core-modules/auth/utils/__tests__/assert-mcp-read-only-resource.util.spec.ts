import { assertMcpReadOnlyResource } from 'src/engine/core-modules/auth/utils/assert-mcp-read-only-resource.util';
import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/jwt-token-type.enum';
import { type ApplicationAccessTokenJwtPayload } from 'src/engine/core-modules/auth/types/application-access-token-jwt-payload.type';

describe('read-only MCP credentials', () => {
  const resource = 'https://crm.example.com/mcp/read-only';
  const token: ApplicationAccessTokenJwtPayload = {
    type: JwtTokenTypeEnum.MCP_READ_ONLY_ACCESS,
    sub: 'application',
    applicationId: 'application',
    workspaceId: 'workspace',
    mcpReadOnlyResource: resource,
  };

  it('should accept a token only at the resource it was issued for', () => {
    expect(() => assertMcpReadOnlyResource(token, resource)).not.toThrow();
  });

  it.each([
    undefined,
    'https://crm.example.com/mcp',
    'https://crm.example.com/rest/people',
    'https://other.example.com/mcp/read-only',
  ])('should reject the token outside its read-only resource: %s', (target) => {
    expect(() => assertMcpReadOnlyResource(token, target)).toThrow(
      'restricted',
    );
  });

  it('should reject a refresh token used as an access token', () => {
    expect(() =>
      assertMcpReadOnlyResource(
        { ...token, type: JwtTokenTypeEnum.MCP_READ_ONLY_REFRESH },
        resource,
      ),
    ).toThrow('restricted');
  });

  it('should preserve unrestricted token behavior', () => {
    const { mcpReadOnlyResource: _restriction, ...unrestricted } = token;
    expect(() =>
      assertMcpReadOnlyResource({
        ...unrestricted,
        type: JwtTokenTypeEnum.APPLICATION_ACCESS,
      }),
    ).not.toThrow();
  });
  it('should reject a restricted access token without its resource claim', () => {
    const { mcpReadOnlyResource: _resource, ...withoutResource } = token;
    expect(() => assertMcpReadOnlyResource(withoutResource, resource)).toThrow(
      'restricted',
    );
  });
});
