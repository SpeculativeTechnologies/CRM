// Tables a device may sync through the local-first shape proxy. This list is
// the security boundary: which columns of these tables travel is derived from
// the live schema (see LocalFirstSchemaService), because record pages request
// every field of an object, so a hand-picked column list can only ever serve
// part of a query.
//
// The set is what the People view needs to be answerable locally: person plus
// the objects its relations reach (company directly, and the two join objects
// behind caredForPets and previousCompanies, plus pet through the first).
export const LOCAL_FIRST_SYNCABLE_TABLES: readonly string[] = [
  'person',
  'company',
  '_petCareAgreement',
  '_pet',
  '_employmentHistory',
];
