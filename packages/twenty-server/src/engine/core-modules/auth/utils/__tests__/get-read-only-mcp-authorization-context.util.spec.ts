import { getReadOnlyMcpAuthorizationContext } from 'src/engine/core-modules/auth/utils/get-read-only-mcp-authorization-context.util';

describe('read-only MCP consent', () => {
  const options = {
    scopes: ['mcp:read'],
    resource: 'https://api.example.com/mcp/read-only',
    requestBaseUrl: 'https://app.example.com',
    serverUrl: 'https://api.example.com',
  };

  it('should bind consent to the published read-only API resource', () => {
    expect(getReadOnlyMcpAuthorizationContext(options)).toEqual({
      mcpReadOnlyResource: options.resource,
    });
  });

  it.each([
    undefined,
    'https://api.example.com/mcp',
    'https://attacker.example.com/mcp/read-only',
  ])('should reject a missing or unpublished resource: %s', (resource) => {
    expect(() =>
      getReadOnlyMcpAuthorizationContext({ ...options, resource }),
    ).toThrow();
  });

  it('should refuse combining read-only consent with general API access', () => {
    expect(() =>
      getReadOnlyMcpAuthorizationContext({
        ...options,
        scopes: ['mcp:read', 'api'],
      }),
    ).toThrow();
  });

  it('should preserve existing OAuth consent', () => {
    expect(
      getReadOnlyMcpAuthorizationContext({
        ...options,
        scopes: ['api', 'profile'],
        resource: undefined,
      }),
    ).toEqual({});
  });
});
