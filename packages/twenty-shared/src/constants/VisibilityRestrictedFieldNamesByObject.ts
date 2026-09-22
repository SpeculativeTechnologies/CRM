// Content fields whose values are gated per record by the owning channel's
// visibility setting, redacted by the message and calendar event visibility
// query hooks. Any API surface that can project a raw column value has to
// refuse these, because the gate is per record and cannot be applied to a
// value that several records collapse into (a groupBy dimension key).
//
// Keep in sync with apply-messages-visibility-restrictions.service.ts and
// apply-calendar-events-visibility-restrictions.service.ts.
export const VISIBILITY_RESTRICTED_FIELD_NAMES_BY_OBJECT: Record<
  string,
  readonly string[]
> = {
  message: ['subject', 'text'],
  calendarEvent: ['title', 'description'],
};
