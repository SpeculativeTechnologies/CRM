import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { McpAuthGuard } from 'src/engine/api/mcp/guards/mcp-auth.guard';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { ApplicationAuthorizationService } from 'src/engine/core-modules/application/application-authorization/services/application-authorization.service';

describe('McpAuthGuard', () => {
  let guard: McpAuthGuard;
  let jwtAuthGuard: jest.Mocked<JwtAuthGuard>;

  const mockSetHeader = jest.fn();
  const findByUserAndApplication = jest.fn();
  const buildContext = (
    host = 'crm.example.com',
    request: Record<string, unknown> = {},
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getResponse: () => ({ setHeader: mockSetHeader }),
        getRequest: () => ({
          protocol: 'https',
          get: (name: string) => (name === 'host' ? host : undefined),
          ...request,
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jwtAuthGuard = {
      canActivate: jest.fn(),
    } as unknown as jest.Mocked<JwtAuthGuard>;

    guard = new McpAuthGuard(jwtAuthGuard, {
      findByUserAndApplication,
    } as unknown as ApplicationAuthorizationService);
    findByUserAndApplication.mockReset();
    mockSetHeader.mockClear();
  });

  it('should return true when JwtAuthGuard passes', async () => {
    jwtAuthGuard.canActivate.mockResolvedValue(true);

    const result = await guard.canActivate(buildContext());

    expect(result).toBe(true);
    expect(mockSetHeader).not.toHaveBeenCalled();
  });

  it('should set WWW-Authenticate using the request host and throw when auth fails', async () => {
    jwtAuthGuard.canActivate.mockResolvedValue(false);

    await expect(
      guard.canActivate(buildContext('acme.twenty.com')),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockSetHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Bearer resource_metadata="https://acme.twenty.com/.well-known/oauth-protected-resource/mcp", scope="api profile"',
    );
  });

  const readOnlyRequest = {
    path: '/mcp/read-only',
    mcpReadOnlyResource: 'https://crm.example.com/mcp/read-only',
    user: { id: 'user' },
    application: { id: 'application' },
    workspace: { id: 'workspace' },
  };

  it('should accept a restricted token with active consent in its workspace', async () => {
    jwtAuthGuard.canActivate.mockResolvedValue(true);
    findByUserAndApplication.mockResolvedValue({
      workspaceId: 'workspace',
      revokedAt: null,
      scopes: ['mcp:read'],
    });
    await expect(
      guard.canActivate(buildContext(undefined, readOnlyRequest)),
    ).resolves.toBe(true);
  });

  it.each([
    null,
    { workspaceId: 'workspace', revokedAt: new Date(), scopes: ['mcp:read'] },
    { workspaceId: 'other', revokedAt: null, scopes: ['mcp:read'] },
    { workspaceId: 'workspace', revokedAt: null, scopes: ['api'] },
  ])(
    'should reject missing, revoked, or mismatched consent',
    async (authorization) => {
      jwtAuthGuard.canActivate.mockResolvedValue(true);
      findByUserAndApplication.mockResolvedValue(authorization);
      await expect(
        guard.canActivate(buildContext(undefined, readOnlyRequest)),
      ).rejects.toThrow(UnauthorizedException);
    },
  );

  it.each(['/mcp/read-only', '/MCP/READ-ONLY', '/mcp/read-only/'])(
    'should require restricted credentials at %s even when the caller is authenticated',
    async (path) => {
      jwtAuthGuard.canActivate.mockResolvedValue(true);
      await expect(
        guard.canActivate(buildContext(undefined, { path })),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockSetHeader).toHaveBeenCalledWith(
        'WWW-Authenticate',
        'Bearer resource_metadata="https://crm.example.com/.well-known/oauth-protected-resource/mcp/read-only", scope="mcp:read"',
      );
    },
  );
});
