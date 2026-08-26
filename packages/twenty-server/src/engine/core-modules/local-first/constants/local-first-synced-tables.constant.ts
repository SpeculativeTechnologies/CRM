// Tables a device may sync through the local-first shape proxy, with the
// exact columns Electric is allowed to serve. Postgres GENERATED columns
// (e.g. person.searchVector) cannot travel over logical replication, so each
// table lists its columns explicitly instead of syncing "*". The frontend
// mirror of this list lives in
// packages/twenty-front/src/modules/local-first/constants/LOCAL_FIRST_PERSON_COLUMNS.ts.
export const LOCAL_FIRST_SYNCED_TABLES: Record<string, readonly string[]> = {
  // deletedAt, position and createdAt are not display fields: they are what
  // makes a local read match the server's answer. The API excludes
  // soft-deleted rows by default while logical replication ships every row,
  // and the standard views order by position.
  person: [
    'id',
    'nameFirstName',
    'nameLastName',
    'jobTitle',
    'emailsPrimaryEmail',
    'position',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ],
};
