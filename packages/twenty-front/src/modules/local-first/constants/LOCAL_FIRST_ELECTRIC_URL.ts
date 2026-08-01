// 127.0.0.1, not localhost: Chrome's network permission model treats a
// localhost-origin page fetching a different localhost port as a stricter
// case than a literal loopback IP, and blocks it with an opaque "Failed to
// fetch" (observed directly -- fetching from a localhost:3001 page succeeded
// against 127.0.0.1:3010 but failed against localhost:3010).
export const LOCAL_FIRST_ELECTRIC_URL =
  (import.meta.env.REACT_APP_LOCAL_FIRST_ELECTRIC_URL as string | undefined) ??
  'http://127.0.0.1:3010/v1/shape';
