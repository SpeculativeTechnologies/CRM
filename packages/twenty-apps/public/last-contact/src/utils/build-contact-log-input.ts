import {
  CONTACT_LOG_CHANNELS,
  CONTACT_LOG_DIRECTIONS,
} from 'src/constants/contact-log-options';

export type ContactLogInput = {
  personId: string;
  channel: string;
  direction: string;
  occurredAt: string;
  notes: string;
};

export const toLocalDateTimeInput = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export const buildContactLogInput = (
  input: ContactLogInput,
  now = new Date(),
) => {
  const channel = CONTACT_LOG_CHANNELS.find(
    (option) => option.value === input.channel,
  );
  if (!input.personId) {
    throw new Error('Select one person to log contact.');
  }
  if (
    !channel ||
    !CONTACT_LOG_DIRECTIONS.some((option) => option.value === input.direction)
  ) {
    throw new Error('Choose a channel and direction.');
  }
  const timestamp = Date.parse(input.occurredAt);
  if (!Number.isFinite(timestamp)) {
    throw new Error('Enter a valid contact date.');
  }
  if (timestamp > now.getTime()) {
    throw new Error('Contact date must be in the past.');
  }
  return {
    personId: input.personId,
    name: channel.label,
    channel: channel.value,
    direction: input.direction,
    occurredAt: new Date(timestamp).toISOString(),
    notes: input.notes.trim(),
  };
};
