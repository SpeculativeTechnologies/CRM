// Mirrors the server-side whitelist in
// engine/core-modules/local-first/constants/local-first-synced-tables.constant.ts
// (authoritative). Postgres GENERATED columns (e.g. person.searchVector)
// cannot travel over logical replication, so shapes list columns explicitly.
//
// deletedAt, position and createdAt are synced because they decide whether a
// local read agrees with the server: the API hides soft-deleted rows by
// default while replication ships every row, and standard views sort by
// position.
export const LOCAL_FIRST_PERSON_COLUMNS = [
  'id',
  'nameFirstName',
  'nameLastName',
  'jobTitle',
  'emailsPrimaryEmail',
  'position',
  'createdAt',
  'updatedAt',
  'deletedAt',
] as const;
