import { isNonEmptyString } from '@sniptt/guards';
import { MessageParticipantRole } from 'twenty-shared/types';

import { type CampaignReplyAttribution } from 'src/engine/core-modules/emailing-domain/types/attribute-campaign-reply-job-data.type';
import { MessageDirection } from 'src/modules/messaging/common/enums/message-direction.enum';
import { type MessageWithParticipants } from 'src/modules/messaging/message-import-manager/types/message';
import { extractReplyHeaderMessageIds } from 'src/modules/messaging/message-import-manager/utils/extract-reply-header-message-ids.util';
import { isAutoReplyMessage } from 'src/modules/messaging/message-import-manager/utils/is-auto-reply-message.util';

// Outgoing messages are excluded because the campaign message itself is saved
// through the same choke point, and an out-of-office answers a campaign's
// In-Reply-To just as a human would, which would inflate the reply rate.
//
// Reply headers stay required even though the thread can locate the campaign
// message on its own: they are what makes an autoresponder detectable, and
// attributing a header-less message by thread alone would count one.
export const buildCampaignReplyAttributions = (
  messages: MessageWithParticipants[],
  messageThreadIdByMessageExternalId?: Map<string, string>,
): CampaignReplyAttribution[] =>
  messages.flatMap((message) => {
    if (message.direction !== MessageDirection.INCOMING || message.isDraft) {
      return [];
    }

    const headers = message.messageHeaders ?? [];
    const replyHeaderMessageIds = extractReplyHeaderMessageIds(headers);
    const senderHandle = message.participants.find(
      ({ role }) => role === MessageParticipantRole.FROM,
    )?.handle;

    if (
      replyHeaderMessageIds.length === 0 ||
      !isNonEmptyString(senderHandle) ||
      isAutoReplyMessage(headers)
    ) {
      return [];
    }

    const messageThreadId = messageThreadIdByMessageExternalId?.get(
      message.externalId,
    );

    return [
      {
        replyHeaderMessageIds,
        senderHandle,
        ...(isNonEmptyString(messageThreadId) ? { messageThreadId } : {}),
        ...(message.receivedAt instanceof Date
          ? { receivedAt: message.receivedAt.toISOString() }
          : {}),
      },
    ];
  });
