import crypto from 'crypto';

import { OAuthService } from 'src/engine/core-modules/application/application-oauth/oauth.service';

const RESOURCE = 'https://crm.example.com/mcp/read-only';
const CLIENT_ID = 'client';
const VERIFIER = 'synthetic-pkce-verifier';

describe('Read-only OAuth grants', () => {
  const registration = {
    id: 'registration',
    oAuthClientId: CLIENT_ID,
    oAuthClientSecretHash: null,
    oAuthScopes: ['mcp:read'],
  };
  const payload = {
    workspaceId: 'workspace',
    applicationId: 'application',
    userId: 'user',
    userWorkspaceId: 'member',
    mcpReadOnlyResource: RESOURCE,
  };
  const tokenPair = {
    applicationAccessToken: { token: 'access' },
    applicationRefreshToken: { token: 'refresh' },
  };
  const appTokenRepository = { findOne: jest.fn(), update: jest.fn() };
  const applicationTokenService = {
    generateApplicationTokenPair: jest.fn(),
    renewApplicationTokens: jest.fn(),
    generateApplicationAccessToken: jest.fn(),
    validateApplicationRefreshToken: jest.fn(),
  };
  const authorizationService = {
    recordAuthorization: jest.fn(),
    findByUserAndApplication: jest.fn(),
    touchLastUsedAt: jest.fn(),
  };
  const service = new OAuthService(
    appTokenRepository as never,
    {
      findOne: jest.fn().mockResolvedValue({
        id: 'application',
        applicationRegistrationId: 'registration',
      }),
    } as never,
    {} as never,
    { findOne: jest.fn().mockResolvedValue({ id: 'member' }) } as never,
    applicationTokenService as never,
    authorizationService as never,
    { findOneByClientId: jest.fn().mockResolvedValue(registration) } as never,
    {} as never,
    {} as never,
    { get: jest.fn().mockReturnValue('30m') } as never,
  );
  const codeRequest = {
    authorizationCode: 'code',
    clientId: CLIENT_ID,
    codeVerifier: VERIFIER,
    redirectUri: 'https://example.com/callback',
    resource: RESOURCE,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    appTokenRepository.findOne.mockResolvedValue({
      id: 'code-id',
      userId: 'user',
      workspaceId: 'workspace',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      context: {
        clientId: CLIENT_ID,
        redirectUri: codeRequest.redirectUri,
        codeChallenge: crypto
          .createHash('sha256')
          .update(VERIFIER)
          .digest('base64url'),
        scope: 'mcp:read',
        mcpReadOnlyResource: RESOURCE,
      },
    });
    appTokenRepository.update.mockResolvedValue({ affected: 1 });
    applicationTokenService.generateApplicationTokenPair.mockResolvedValue(
      tokenPair,
    );
    applicationTokenService.renewApplicationTokens.mockResolvedValue(tokenPair);
    applicationTokenService.validateApplicationRefreshToken.mockResolvedValue(
      payload,
    );
    authorizationService.findByUserAndApplication.mockResolvedValue({
      id: 'authorization',
      revokedAt: null,
    });
  });

  it.each([
    undefined,
    'https://crm.example.com/mcp',
    'https://other.example.com/mcp/read-only',
  ])(
    'should reject a mismatched resource without consuming the authorization code',
    async (resource) => {
      await expect(
        service.exchangeAuthorizationCode({ ...codeRequest, resource }),
      ).resolves.toMatchObject({ error: 'invalid_target' });
      expect(appTokenRepository.update).not.toHaveBeenCalled();
      expect(
        applicationTokenService.generateApplicationTokenPair,
      ).not.toHaveBeenCalled();
    },
  );

  it('should issue resource-bound credentials after PKCE verification', async () => {
    await expect(
      service.exchangeAuthorizationCode(codeRequest),
    ).resolves.toMatchObject({ access_token: 'access', scope: 'mcp:read' });
    expect(
      applicationTokenService.generateApplicationTokenPair,
    ).toHaveBeenCalledWith(payload);
  });

  it('should reject the wrong PKCE verifier before issuing credentials', async () => {
    await expect(
      service.exchangeAuthorizationCode({
        ...codeRequest,
        codeVerifier: 'wrong',
      }),
    ).resolves.toMatchObject({ error: 'invalid_grant' });
    expect(
      applicationTokenService.generateApplicationTokenPair,
    ).not.toHaveBeenCalled();
  });

  it('should retain resource binding on refresh and reject a different resource', async () => {
    const request = {
      refreshToken: 'refresh',
      clientId: CLIENT_ID,
      resource: RESOURCE,
    };
    await expect(
      service.refreshTokenGrant({
        ...request,
        resource: 'https://crm.example.com/mcp',
      }),
    ).resolves.toMatchObject({ error: 'invalid_target' });
    expect(
      applicationTokenService.renewApplicationTokens,
    ).not.toHaveBeenCalled();
    await expect(service.refreshTokenGrant(request)).resolves.toMatchObject({
      scope: 'mcp:read',
    });
    expect(applicationTokenService.renewApplicationTokens).toHaveBeenCalledWith(
      payload,
    );
  });

  it('should not refresh revoked access', async () => {
    authorizationService.findByUserAndApplication.mockResolvedValue({
      revokedAt: new Date(),
    });
    await expect(
      service.refreshTokenGrant({
        refreshToken: 'refresh',
        clientId: CLIENT_ID,
        resource: RESOURCE,
      }),
    ).resolves.toMatchObject({ error: 'invalid_grant' });
    expect(
      applicationTokenService.renewApplicationTokens,
    ).not.toHaveBeenCalled();
  });

  it('should refuse client credentials for a read-only registration', async () => {
    await expect(
      service.clientCredentialsGrant({
        clientId: CLIENT_ID,
        clientSecret: 'secret',
      }),
    ).resolves.toMatchObject({ error: 'unauthorized_client' });
    expect(
      applicationTokenService.generateApplicationAccessToken,
    ).not.toHaveBeenCalled();
  });
});
