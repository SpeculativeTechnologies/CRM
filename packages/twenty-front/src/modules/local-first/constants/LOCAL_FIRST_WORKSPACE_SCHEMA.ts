// Spike-only config: the Electric shape API operates directly on Postgres
// schemas, one level below the per-workspace GraphQL layer, so it needs the
// workspace's Postgres schema name rather than a workspace id. There's no
// dynamic per-workspace resolution yet (that needs an authenticated backend
// endpoint, tracked as later local-first work) -- for now this only works
// against the single workspace named via env var.
export const LOCAL_FIRST_WORKSPACE_SCHEMA = import.meta.env
  .REACT_APP_LOCAL_FIRST_WORKSPACE_SCHEMA as string | undefined;
