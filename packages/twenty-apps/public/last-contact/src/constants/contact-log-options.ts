import {
  CONTACT_LOG_LINKEDIN_OPTION_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_TEXT_OPTION_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_PHONE_OPTION_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_WHATSAPP_OPTION_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_SIGNAL_OPTION_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_IN_PERSON_OPTION_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_OTHER_OPTION_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_OUTBOUND_OPTION_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_INBOUND_OPTION_UNIVERSAL_IDENTIFIER,
  CONTACT_LOG_BOTH_OPTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export const CONTACT_LOG_CHANNELS = [
  {
    id: CONTACT_LOG_LINKEDIN_OPTION_UNIVERSAL_IDENTIFIER,
    value: 'LINKEDIN',
    label: 'LinkedIn',
    color: 'blue',
    position: 0,
  },
  {
    id: CONTACT_LOG_TEXT_OPTION_UNIVERSAL_IDENTIFIER,
    value: 'TEXT',
    label: 'Text message',
    color: 'green',
    position: 1,
  },
  {
    id: CONTACT_LOG_PHONE_OPTION_UNIVERSAL_IDENTIFIER,
    value: 'PHONE',
    label: 'Phone call',
    color: 'orange',
    position: 2,
  },
  {
    id: CONTACT_LOG_WHATSAPP_OPTION_UNIVERSAL_IDENTIFIER,
    value: 'WHATSAPP',
    label: 'WhatsApp',
    color: 'green',
    position: 3,
  },
  {
    id: CONTACT_LOG_SIGNAL_OPTION_UNIVERSAL_IDENTIFIER,
    value: 'SIGNAL',
    label: 'Signal',
    color: 'blue',
    position: 4,
  },
  {
    id: CONTACT_LOG_IN_PERSON_OPTION_UNIVERSAL_IDENTIFIER,
    value: 'IN_PERSON',
    label: 'In person',
    color: 'purple',
    position: 5,
  },
  {
    id: CONTACT_LOG_OTHER_OPTION_UNIVERSAL_IDENTIFIER,
    value: 'OTHER',
    label: 'Other',
    color: 'gray',
    position: 6,
  },
] as const;

export const CONTACT_LOG_DIRECTIONS = [
  {
    id: CONTACT_LOG_OUTBOUND_OPTION_UNIVERSAL_IDENTIFIER,
    value: 'OUTBOUND',
    label: 'I reached out',
    color: 'blue',
    position: 0,
  },
  {
    id: CONTACT_LOG_INBOUND_OPTION_UNIVERSAL_IDENTIFIER,
    value: 'INBOUND',
    label: 'They reached out',
    color: 'green',
    position: 1,
  },
  {
    id: CONTACT_LOG_BOTH_OPTION_UNIVERSAL_IDENTIFIER,
    value: 'BOTH',
    label: 'Conversation',
    color: 'purple',
    position: 2,
  },
] as const;

export type ContactLogDirection =
  (typeof CONTACT_LOG_DIRECTIONS)[number]['value'];
