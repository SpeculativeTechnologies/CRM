import { MessageCampaignStatus } from 'twenty-shared/types';

export const resolveCompletedCampaignStatus = (
  failedCount: number,
): MessageCampaignStatus =>
  failedCount > 0
    ? MessageCampaignStatus.SENT_WITH_ERRORS
    : MessageCampaignStatus.SENT;

// A campaign stays in SENDING until none of its messages are waiting to go out.
// Null means the campaign is still in flight and must keep its current status.
export const computeCampaignTerminalStatus = ({
  queuedCount,
  failedCount,
}: {
  queuedCount: number;
  failedCount: number;
}): MessageCampaignStatus | null =>
  queuedCount > 0 ? null : resolveCompletedCampaignStatus(failedCount);
