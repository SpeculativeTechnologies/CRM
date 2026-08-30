import { Injectable, Logger } from '@nestjs/common';

import { MessageParticipantRole } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { In, IsNull, Not } from 'typeorm';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { CampaignStatsRefreshSchedulerService } from 'src/modules/emailing/services/campaign-stats-refresh-scheduler.service';
import { MessageParticipantWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-participant.workspace-entity';
import { MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';

type RecordEngagementArgs = {
  workspaceId: string;
  campaignId: string;
  messageId: string;
};

type RecordReplyArgs = {
  workspaceId: string;
  replyHeaderMessageIds: string[];
  senderHandle: string;
};

@Injectable()
export class MessageEngagementService {
  private readonly logger = new Logger(MessageEngagementService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly campaignStatsRefreshSchedulerService: CampaignStatsRefreshSchedulerService,
  ) {}

  async recordOpen(args: RecordEngagementArgs): Promise<void> {
    await this.record(args, { isClick: false });
  }

  async recordClick(args: RecordEngagementArgs): Promise<void> {
    await this.record(args, { isClick: true });
  }

  // The reply itself is imported as its own message; this only stamps the
  // campaign message it answers, so the count stays one per recipient however
  // many times they write back.
  async recordReply({
    workspaceId,
    replyHeaderMessageIds,
    senderHandle,
  }: RecordReplyArgs): Promise<void> {
    const normalizedSenderHandle = senderHandle.trim().toLowerCase();

    if (replyHeaderMessageIds.length === 0 || normalizedSenderHandle === '') {
      return;
    }

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const messageRepository =
        await this.globalWorkspaceOrmManager.getRepository(
          workspaceId,
          MessageWorkspaceEntity,
          { shouldBypassPermissionChecks: true },
        );

      const candidateMessages = await messageRepository.find({
        where: {
          headerMessageId: In(replyHeaderMessageIds),
          messageCampaignId: Not(IsNull()),
          repliedAt: IsNull(),
        },
      });

      if (candidateMessages.length === 0) {
        return;
      }

      // A campaign's Cc addresses are the same on every send and carry no
      // message of their own, so without this the Cc'd party answering any
      // recipient's email would be counted as that recipient replying.
      const recipientMessageIds = await this.findMessageIdsAddressedTo({
        workspaceId,
        messageIds: candidateMessages.map(({ id }) => id),
        handle: normalizedSenderHandle,
      });

      // replyHeaderMessageIds is ordered most-specific first, so a reply deep in
      // a thread is attributed to the message it actually answers rather than to
      // whichever ancestor the database happened to return first.
      const message = replyHeaderMessageIds
        .map((headerMessageId) =>
          candidateMessages.find(
            (candidate) =>
              candidate.headerMessageId === headerMessageId &&
              recipientMessageIds.has(candidate.id),
          ),
        )
        .find(isDefined);

      if (!isDefined(message) || !isDefined(message.messageCampaignId)) {
        return;
      }

      const campaignId = message.messageCampaignId;

      await messageRepository.update(
        { id: message.id, repliedAt: IsNull() },
        { repliedAt: new Date() },
      );

      this.logger.log(
        `Recorded reply to campaign ${campaignId} on message ${message.id}`,
      );

      await this.campaignStatsRefreshSchedulerService.schedule({
        workspaceId,
        campaignId,
      });
    }, buildSystemAuthContext(workspaceId));
  }

  private async findMessageIdsAddressedTo({
    workspaceId,
    messageIds,
    handle,
  }: {
    workspaceId: string;
    messageIds: string[];
    handle: string;
  }): Promise<Set<string>> {
    const participantRepository =
      await this.globalWorkspaceOrmManager.getRepository(
        workspaceId,
        MessageParticipantWorkspaceEntity,
        { shouldBypassPermissionChecks: true },
      );

    const participants = await participantRepository.find({
      where: {
        messageId: In(messageIds),
        role: MessageParticipantRole.TO,
      },
    });

    return new Set(
      participants
        .filter(
          (participant) => participant.handle?.trim().toLowerCase() === handle,
        )
        .map(({ messageId }) => messageId),
    );
  }

  private async record(
    { workspaceId, campaignId, messageId }: RecordEngagementArgs,
    { isClick }: { isClick: boolean },
  ): Promise<void> {
    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const messageRepository =
        await this.globalWorkspaceOrmManager.getRepository(
          workspaceId,
          MessageWorkspaceEntity,
          { shouldBypassPermissionChecks: true },
        );

      const scope = { id: messageId, messageCampaignId: campaignId };

      const message = await messageRepository.findOne({ where: scope });

      if (message === null) {
        this.logger.warn(
          `Discarded tracking hit for unknown message ${messageId} on campaign ${campaignId}`,
        );

        return;
      }

      const occurredAt = new Date();

      // The workspace repository has no atomic increment, so two hits arriving
      // in the same instant can cost one count. The first-touch timestamps
      // below carry the IsNull guard and stay exact, and they are what the
      // campaign open and click rates are computed from.
      await messageRepository.update(
        scope,
        isClick
          ? { clickCount: message.clickCount + 1 }
          : { openCount: message.openCount + 1 },
      );

      // A click proves the recipient saw the email, so it backfills the open
      // timestamp for the many clients that never load the pixel.
      await messageRepository.update(
        { ...scope, openedAt: IsNull() },
        { openedAt: occurredAt },
      );

      if (isClick) {
        await messageRepository.update(
          { ...scope, clickedAt: IsNull() },
          { clickedAt: occurredAt },
        );
      }

      await this.campaignStatsRefreshSchedulerService.schedule({
        workspaceId,
        campaignId,
      });
    }, buildSystemAuthContext(workspaceId));
  }
}
