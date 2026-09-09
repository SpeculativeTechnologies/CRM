export const PERSON_CONTACT_FIELDS = [
  'lastContactAt',
  'lastContactById',
  'lastOutboundAt',
  'lastInboundAt',
  'lastEmailId',
  'lastMeetingId',
  'lastContactItemMessageId',
  'lastContactItemCalendarEventId',
  'lastContactItemContactLogId',
] as const;

export type PersonContactSnapshot = Partial<
  Record<(typeof PERSON_CONTACT_FIELDS)[number], string | null>
>;

export const PERSON_CONTACT_SELECTION = Object.fromEntries(
  PERSON_CONTACT_FIELDS.map((field) => [field, true]),
) as Record<(typeof PERSON_CONTACT_FIELDS)[number], true>;

// Compare the contact values that were read before aggregation. updatedAt can
// contain sub-millisecond database precision lost by the API's date serializer.
export const buildPersonContactSnapshotFilter = (
  person: PersonContactSnapshot,
) =>
  PERSON_CONTACT_FIELDS.map((field) => ({
    [field]: person[field] ? { eq: person[field] } : { is: 'NULL' },
  }));
