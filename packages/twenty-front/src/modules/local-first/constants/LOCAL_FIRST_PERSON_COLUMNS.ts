// Postgres GENERATED columns (e.g. person.searchVector) cannot travel over
// logical replication, so Electric shapes must list columns explicitly and
// exclude them.
export const LOCAL_FIRST_PERSON_COLUMNS = [
  'id',
  'nameFirstName',
  'nameLastName',
  'jobTitle',
  'emailsPrimaryEmail',
  'updatedAt',
] as const;
