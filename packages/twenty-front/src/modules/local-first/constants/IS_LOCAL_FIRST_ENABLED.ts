// Spike gate: the local-first debug panel and sync loop only run when
// explicitly enabled. The server must also have ELECTRIC_URL configured, or
// the shape proxy answers 404 and the panel just shows "offline".
export const IS_LOCAL_FIRST_ENABLED =
  (import.meta.env.REACT_APP_IS_LOCAL_FIRST_ENABLED as string | undefined) ===
  'true';
