// Converts a value read from the local mirror into the representation the API
// would have sent, because the UI parses these values rather than just
// displaying them.
//
// PGlite returns native types (Date for timestamps) while the API sends JSON
// (ISO strings). Handing a Date to the date field crashes its formatter and
// the error boundary blanks the whole table. The comparison layer normalises
// these to equal on purpose, so it cannot catch this: agreeing on a value is
// not the same as serving it in the right shape.
export const toApiValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();

  return value;
};
