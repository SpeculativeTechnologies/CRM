// Composite subfields the API exposes as a list. Their columns are jsonb and
// hold SQL NULL when empty, while the API returns [], so a local read has to
// emit [] too or every record looks different from the server's answer.
export const LOCAL_FIRST_LIST_VALUED_SUBFIELDS: readonly string[] = [
  'additionalEmails',
  'additionalPhones',
  'secondaryLinks',
];
