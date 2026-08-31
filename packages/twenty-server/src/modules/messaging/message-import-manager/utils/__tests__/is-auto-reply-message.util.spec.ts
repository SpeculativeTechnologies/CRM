import { isAutoReplyMessage } from 'src/modules/messaging/message-import-manager/utils/is-auto-reply-message.util';

describe('isAutoReplyMessage', () => {
  it('treats a plain human reply as a reply', () => {
    expect(
      isAutoReplyMessage([
        { name: 'From', value: 'someone@example.com' },
        { name: 'In-Reply-To', value: '<abc@example.com>' },
      ]),
    ).toBe(false);
  });

  it('catches RFC 3834 auto responders', () => {
    expect(
      isAutoReplyMessage([{ name: 'Auto-Submitted', value: 'auto-replied' }]),
    ).toBe(true);
    expect(
      isAutoReplyMessage([{ name: 'auto-submitted', value: 'auto-generated' }]),
    ).toBe(true);
  });

  it('does not count an explicit Auto-Submitted: no', () => {
    expect(isAutoReplyMessage([{ name: 'Auto-Submitted', value: 'no' }])).toBe(
      false,
    );
  });

  it('catches the non-standard headers clients send instead', () => {
    expect(isAutoReplyMessage([{ name: 'X-Autoreply', value: 'yes' }])).toBe(
      true,
    );
    expect(isAutoReplyMessage([{ name: 'X-Autorespond', value: 'OOF' }])).toBe(
      true,
    );
    expect(
      isAutoReplyMessage([{ name: 'X-Auto-Response-Suppress', value: 'All' }]),
    ).toBe(true);
    expect(
      isAutoReplyMessage([{ name: 'Precedence', value: 'auto_reply' }]),
    ).toBe(true);
  });

  it('ignores an empty flag header', () => {
    expect(isAutoReplyMessage([{ name: 'X-Autoreply', value: '  ' }])).toBe(
      false,
    );
  });
});
