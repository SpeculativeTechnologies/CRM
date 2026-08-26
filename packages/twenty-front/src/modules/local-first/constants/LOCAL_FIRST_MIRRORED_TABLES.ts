// Tables the client tries to mirror. A table the workspace does not have (the
// fork's custom objects differ between the seed fixture and production) simply
// does not sync: the coverage check then refuses any query that needs it,
// rather than the whole mirror failing.
export const LOCAL_FIRST_MIRRORED_TABLES = [
  'person',
  'company',
  '_petCareAgreement',
  '_pet',
  '_employmentHistory',
] as const;
