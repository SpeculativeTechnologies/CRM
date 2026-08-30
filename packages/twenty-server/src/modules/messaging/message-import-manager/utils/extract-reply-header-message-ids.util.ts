import { type MessageHeader } from 'src/modules/messaging/message-import-manager/types/message';

const readHeaderValues = (
  headers: MessageHeader[],
  headerName: string,
): string[] =>
  headers
    .filter(({ name }) => name.toLowerCase() === headerName)
    .flatMap(({ value }) => value.trim().split(/\s+/))
    .filter((token) => token.length > 0);

// Providers hand back a bare id at send time (SES `MessageId`, a Resend uuid)
// but put it in the header as `<id@provider-host>`, so a reply's In-Reply-To
// only matches the stored headerMessageId once the host is stripped too.
const expandCandidates = (rawId: string): string[] => {
  const stripped = rawId.replace(/^</, '').replace(/>$/, '').trim();

  if (stripped.length === 0) {
    return [];
  }

  const atIndex = stripped.lastIndexOf('@');
  const localPart = atIndex === -1 ? null : stripped.slice(0, atIndex);

  return localPart === null || localPart.length === 0
    ? [stripped]
    : [stripped, localPart];
};

// In-Reply-To points at the message actually being answered, References carries
// the whole ancestry, so In-Reply-To candidates come first and callers can take
// the earliest match as the best attribution.
export const extractReplyHeaderMessageIds = (
  headers: MessageHeader[],
): string[] => {
  const orderedRawIds = [
    ...readHeaderValues(headers, 'in-reply-to'),
    ...readHeaderValues(headers, 'references').reverse(),
  ];

  return [...new Set(orderedRawIds.flatMap(expandCandidates))];
};
