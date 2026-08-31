import { isNonEmptyString } from '@sniptt/guards';

import { type MessageHeader } from 'src/modules/messaging/message-import-manager/types/message';

const AUTO_REPLY_FLAG_HEADER_NAMES = [
  'x-autoreply',
  'x-autorespond',
  'x-auto-response-suppress',
];
const AUTO_REPLY_PRECEDENCE_VALUES = ['auto_reply', 'bulk', 'junk', 'list'];

// RFC 3834 asks responders to set Auto-Submitted; the rest are what the clients
// that ignore it send instead. Anything matching is a machine answering, which
// is exactly what a reply count must not include.
export const isAutoReplyMessage = (headers: MessageHeader[]): boolean =>
  headers.some(({ name, value }) => {
    const headerName = name.toLowerCase();
    const headerValue = value.trim().toLowerCase();

    if (headerName === 'auto-submitted') {
      return isNonEmptyString(headerValue) && headerValue !== 'no';
    }

    if (headerName === 'precedence') {
      return AUTO_REPLY_PRECEDENCE_VALUES.includes(headerValue);
    }

    if (AUTO_REPLY_FLAG_HEADER_NAMES.includes(headerName)) {
      return isNonEmptyString(headerValue);
    }

    return false;
  });
