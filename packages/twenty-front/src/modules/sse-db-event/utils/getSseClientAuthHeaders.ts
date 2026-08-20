import { type AuthTokenPair } from '~/generated-metadata/graphql';

// In cookie mode the session cookie is the credential every other request uses,
// and the stored token pair is left to go stale because nothing renews it.
// Sending that stale bearer made the server reject the subscription outright
// rather than fall back to the cookie, and the client then reconnected forever,
// resyncing the metadata store and every listening query on each attempt.
export const getSseClientAuthHeaders = ({
  isCookieAuthActive,
  tokenPair,
}: {
  isCookieAuthActive: boolean;
  tokenPair: AuthTokenPair | null;
}): Record<string, string> => {
  if (isCookieAuthActive) {
    return {};
  }

  const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

  return { Authorization: token ? `Bearer ${token}` : '' };
};
