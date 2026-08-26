// Tables a device may sync through the local-first shape proxy. This list is
// the security boundary: which columns of these tables travel is derived from
// the live schema (see LocalFirstSchemaService), because the record pages
// request every field of an object, so a hand-picked column list can only ever
// serve part of a query.
export const LOCAL_FIRST_SYNCABLE_TABLES: readonly string[] = ['person'];
