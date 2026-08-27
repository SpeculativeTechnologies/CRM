// Second gate, deliberately separate from IS_LOCAL_FIRST_ENABLED: with sync on
// but this off, local reads are computed and compared against the server
// without being served, which is how confidence is built before the network
// leaves the interactive path.
export const IS_LOCAL_FIRST_READS_ENABLED =
  (import.meta.env.REACT_APP_IS_LOCAL_FIRST_READS_ENABLED as
    | string
    | undefined) === 'true';
