import { ApplicationTokenService } from 'src/engine/core-modules/auth/token/services/application-token.service';
import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/jwt-token-type.enum';

describe('Read-only application credentials', () => {
  const signAsyncOrThrow = jest.fn().mockResolvedValue('signed-token');
  const service = new ApplicationTokenService(
    { signAsyncOrThrow } as never,
    { findOne: jest.fn().mockResolvedValue({ id: 'workspace' }) } as never,
    { findOne: jest.fn().mockResolvedValue({ id: 'application' }) } as never,
    { get: jest.fn().mockReturnValue('30m') } as never,
  );
  const context = {
    workspaceId: 'workspace',
    applicationId: 'application',
    userId: 'user',
    userWorkspaceId: 'member',
    mcpReadOnlyResource: 'https://crm.example.com/mcp/read-only',
  };

  beforeEach(() => jest.clearAllMocks());

  it.each(['generateApplicationTokenPair', 'renewApplicationTokens'] as const)(
    'should preserve the restriction in both credentials during %s',
    async (method) => {
      await service[method](context);
      for (const type of [
        JwtTokenTypeEnum.MCP_READ_ONLY_ACCESS,
        JwtTokenTypeEnum.MCP_READ_ONLY_REFRESH,
      ]) {
        expect(signAsyncOrThrow).toHaveBeenCalledWith(
          expect.objectContaining({ ...context, type }),
          { expiresIn: '30m' },
        );
      }
    },
  );
});
