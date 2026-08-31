import { MessageParticipantRole } from 'twenty-shared/types';

import { MessageDirection } from 'src/modules/messaging/common/enums/message-direction.enum';
import { type MessageWithParticipants } from 'src/modules/messaging/message-import-manager/types/message';
import { buildCampaignReplyAttributions } from 'src/modules/messaging/message-import-manager/utils/build-campaign-reply-attributions.util';

const buildMessage = (
  overrides: Partial<MessageWithParticipants> = {},
): MessageWithParticipants =>
  ({
    externalId: 'external-1',
    headerMessageId: '<reply@example.com>',
    direction: MessageDirection.INCOMING,
    isDraft: false,
    messageHeaders: [
      { name: 'In-Reply-To', value: '<campaign@spec.tech>' },
      { name: 'References', value: '<root@spec.tech> <campaign@spec.tech>' },
    ],
    participants: [
      {
        role: MessageParticipantRole.FROM,
        handle: 'recipient@example.com',
        displayName: 'Recipient',
      },
    ],
    ...overrides,
  }) as MessageWithParticipants;

describe('buildCampaignReplyAttributions', () => {
  it('should return the sender and ordered reply header ids for an incoming reply', () => {
    expect(buildCampaignReplyAttributions([buildMessage()])).toEqual([
      {
        senderHandle: 'recipient@example.com',
        replyHeaderMessageIds: [
          '<campaign@spec.tech>',
          'campaign@spec.tech',
          'campaign',
          '<root@spec.tech>',
          'root@spec.tech',
          'root',
        ],
      },
    ]);
  });

  it('should skip outgoing messages so the campaign message itself is never attributed', () => {
    expect(
      buildCampaignReplyAttributions([
        buildMessage({ direction: MessageDirection.OUTGOING }),
      ]),
    ).toEqual([]);
  });

  it('should skip drafts', () => {
    expect(
      buildCampaignReplyAttributions([buildMessage({ isDraft: true })]),
    ).toEqual([]);
  });

  it('should skip messages without reply headers', () => {
    expect(
      buildCampaignReplyAttributions([buildMessage({ messageHeaders: [] })]),
    ).toEqual([]);
  });

  it('should skip auto-replies', () => {
    expect(
      buildCampaignReplyAttributions([
        buildMessage({
          messageHeaders: [
            { name: 'In-Reply-To', value: '<campaign@spec.tech>' },
            { name: 'Auto-Submitted', value: 'auto-replied' },
          ],
        }),
      ]),
    ).toEqual([]);
  });

  it('should skip messages with no from participant', () => {
    expect(
      buildCampaignReplyAttributions([
        buildMessage({
          participants: [
            {
              role: MessageParticipantRole.TO,
              handle: 'recipient@example.com',
              displayName: 'Recipient',
            },
          ] as MessageWithParticipants['participants'],
        }),
      ]),
    ).toEqual([]);
  });

  it('should keep only the replies in a mixed batch', () => {
    const attributions = buildCampaignReplyAttributions([
      buildMessage({ direction: MessageDirection.OUTGOING }),
      buildMessage({ messageHeaders: [] }),
      buildMessage(),
    ]);

    expect(attributions).toHaveLength(1);
    expect(attributions[0].senderHandle).toBe('recipient@example.com');
  });
});
