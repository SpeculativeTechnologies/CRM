import { extractReplyHeaderMessageIds } from 'src/modules/messaging/message-import-manager/utils/extract-reply-header-message-ids.util';

describe('extractReplyHeaderMessageIds', () => {
  it('returns nothing for a message that starts a thread', () => {
    expect(
      extractReplyHeaderMessageIds([
        { name: 'Message-ID', value: '<abc@example.com>' },
        { name: 'Subject', value: 'Hello' },
      ]),
    ).toEqual([]);
  });

  it('offers the bracketed, unbracketed and bare provider forms of one id', () => {
    expect(
      extractReplyHeaderMessageIds([
        {
          name: 'In-Reply-To',
          value: '<0100019abc-000000@eu-west-1.amazonses.com>',
        },
      ]),
    ).toEqual([
      '<0100019abc-000000@eu-west-1.amazonses.com>',
      '0100019abc-000000@eu-west-1.amazonses.com',
      '0100019abc-000000',
    ]);
  });

  // A connected-account send stores the header verbatim, brackets included.
  it('matches a headerMessageId stored as the raw header value', () => {
    expect(
      extractReplyHeaderMessageIds([
        { name: 'In-Reply-To', value: '<c0ffee@spec.tech>' },
      ]),
    ).toContain('<c0ffee@spec.tech>');
  });

  it('prefers the answered message over its ancestors', () => {
    const candidates = extractReplyHeaderMessageIds([
      {
        name: 'References',
        value: '<oldest@example.com> <newest@example.com>',
      },
      { name: 'In-Reply-To', value: '<newest@example.com>' },
    ]);

    expect(candidates.indexOf('newest@example.com')).toBeLessThan(
      candidates.indexOf('oldest@example.com'),
    );
    expect(candidates[0]).toBe('<newest@example.com>');
  });

  it('reads References folded across lines and deduplicates', () => {
    expect(
      extractReplyHeaderMessageIds([
        { name: 'references', value: '<a@example.com>\r\n <b@example.com>' },
        { name: 'In-Reply-To', value: '<b@example.com>' },
      ]),
    ).toEqual([
      '<b@example.com>',
      'b@example.com',
      'b',
      '<a@example.com>',
      'a@example.com',
      'a',
    ]);
  });

  it('ignores empty and malformed header values', () => {
    expect(
      extractReplyHeaderMessageIds([
        { name: 'In-Reply-To', value: '   ' },
        { name: 'References', value: '<>' },
      ]),
    ).toEqual([]);
  });

  it('keeps an id that carries no host', () => {
    expect(
      extractReplyHeaderMessageIds([
        { name: 'In-Reply-To', value: '<log-1234>' },
      ]),
    ).toEqual(['<log-1234>', 'log-1234']);
  });
});
