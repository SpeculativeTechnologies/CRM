import { getSseClientAuthHeaders } from '@/sse-db-event/utils/getSseClientAuthHeaders';
import { type AuthTokenPair } from '~/generated-metadata/graphql';

const buildTokenPair = (expiresAt: string): AuthTokenPair =>
  ({
    accessOrWorkspaceAgnosticToken: { token: 'stored-token', expiresAt },
    refreshToken: { token: 'refresh-token', expiresAt },
  }) as AuthTokenPair;

const EXPIRED_TOKEN_PAIR = buildTokenPair('2020-01-01T00:00:00.000Z');
const FRESH_TOKEN_PAIR = buildTokenPair('2999-01-01T00:00:00.000Z');

describe('getSseClientAuthHeaders', () => {
  it('should send no Authorization header in cookie mode, so the cookie authenticates the stream', () => {
    expect(
      getSseClientAuthHeaders({
        isCookieAuthActive: true,
        tokenPair: FRESH_TOKEN_PAIR,
      }),
    ).toEqual({});
  });

  // The reconnect loop behind issue #160: an expired stored token was sent in
  // cookie mode, the server rejected the subscription, and every retry resynced
  // the metadata store and every listening query, wiping row selection.
  it('should not send an expired stored token in cookie mode', () => {
    expect(
      getSseClientAuthHeaders({
        isCookieAuthActive: true,
        tokenPair: EXPIRED_TOKEN_PAIR,
      }),
    ).toEqual({});
  });

  it('should send the stored token as a bearer when cookie auth is not active', () => {
    expect(
      getSseClientAuthHeaders({
        isCookieAuthActive: false,
        tokenPair: FRESH_TOKEN_PAIR,
      }),
    ).toEqual({ Authorization: 'Bearer stored-token' });
  });

  it('should send an empty Authorization header when there is no token and no cookie', () => {
    expect(
      getSseClientAuthHeaders({ isCookieAuthActive: false, tokenPair: null }),
    ).toEqual({ Authorization: '' });
  });
});
