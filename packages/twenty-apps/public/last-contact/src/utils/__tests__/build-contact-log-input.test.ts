import { describe, expect, it } from 'vitest';
import { CONTACT_LOG_CHANNELS } from 'src/constants/contact-log-options';
import {
  buildContactLogInput,
  toLocalDateTimeInput,
} from 'src/utils/build-contact-log-input';

const NOW = new Date('2026-06-10T12:00:00Z');
const INPUT = {
  personId: 'person-1',
  channel: 'LINKEDIN',
  direction: 'OUTBOUND',
  occurredAt: '2026-06-09T08:00:00-04:00',
  notes: '  Sent research brief.  ',
};

describe('contact log form data', () => {
  it.each(CONTACT_LOG_CHANNELS)('should accept $label contact', (channel) => {
    expect(
      buildContactLogInput({ ...INPUT, channel: channel.value }, NOW),
    ).toEqual({
      ...INPUT,
      name: channel.label,
      channel: channel.value,
      occurredAt: '2026-06-09T12:00:00.000Z',
      notes: 'Sent research brief.',
    });
  });
  it.each([
    { personId: '' },
    { occurredAt: '' },
    { occurredAt: 'invalid' },
    { occurredAt: '2026-06-11T12:00:00Z' },
    { channel: 'unknown' },
    { direction: 'unknown' },
  ])('should reject invalid contact input %j', (invalid) => {
    expect(() => buildContactLogInput({ ...INPUT, ...invalid }, NOW)).toThrow();
  });
  it('should round-trip the contact date in the browser timezone to the minute', () => {
    const date = new Date(2026, 5, 10, 8, 35);
    expect(toLocalDateTimeInput(date)).toBe('2026-06-10T08:35');
    expect(new Date(toLocalDateTimeInput(date)).getTime()).toBe(date.getTime());
  });
});
