// The read-only MCP scope additionally restricts the credential to its resource.
// Object, field, and record permissions still use the user/application roles.
export const OAUTH_SCOPES = {
  API: 'api',
  PROFILE: 'profile',
  MCP_READ_ONLY: 'mcp:read',
} as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[keyof typeof OAUTH_SCOPES];

export const ALL_OAUTH_SCOPES: OAuthScope[] = Object.values(OAUTH_SCOPES);

// Existing clients keep their existing defaults. The restricted scope is opt-in.
export const DEFAULT_OAUTH_SCOPES: OAuthScope[] = [
  OAUTH_SCOPES.API,
  OAUTH_SCOPES.PROFILE,
];

export const OAUTH_SCOPE_DESCRIPTIONS: Record<OAuthScope, string> = {
  [OAUTH_SCOPES.API]: 'Access workspace data according to the assigned role',
  [OAUTH_SCOPES.PROFILE]: "Read the authenticated user's profile",
  [OAUTH_SCOPES.MCP_READ_ONLY]:
    'Read CRM records through the read-only MCP endpoint',
};
