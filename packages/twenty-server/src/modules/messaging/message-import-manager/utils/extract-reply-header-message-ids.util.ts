import { type MessageHeader } from 'src/modules/messaging/message-import-manager/types/message';

const readHeaderValues = (
  headers: MessageHeader[],
  headerName: string,
): string[] =>
  headers
    .filter(({ name }) => name.toLowerCase() === headerName)
    .flatMap(({ value }) => value.trim().split(/\s+/))
    .filter((token) => token.length > 0);

// What a send stores as headerMessageId differs by path: a connected-account
// send keeps the raw `<id@host>` header, while a campaign send through SES or
// Resend keeps the provider's bare id. Every form of the same id is offered so
// a reply's In-Reply-To matches whichever one was stored.
const expandCandidates = (rawId: string): string[] => {
  const stripped = rawId.replace(/^</, '').replace(/>$/, '').trim();

  if (stripped.length === 0) {
    return [];
  }

  const atIndex = stripped.lastIndexOf('@');
  const localPart = atIndex === -1 ? null : stripped.slice(0, atIndex);

  return [
    `<${stripped}>`,
    stripped,
    ...(localPart === null || localPart.length === 0 ? [] : [localPart]),
  ];
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
