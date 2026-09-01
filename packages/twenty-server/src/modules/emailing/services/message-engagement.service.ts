import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { MessageParticipantRole } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { In, IsNull, Not } from 'typeorm';

import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { MessageCampaignStatisticsService } from 'src/modules/emailing/services/message-campaign-statistics.service';
import { MessageParticipantWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-participant.workspace-entity';
import { MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';

type RecordEngagementArgs = {
  workspaceId: string;
  campaignId: string;
  messageId?: string;
  personId?: string;
};

type RecordReplyArgs = {
  workspaceId: string;
  replyHeaderMessageIds: string[];
  senderHandle: string;
  messageThreadId?: string;
  receivedAt?: string;
};

@Injectable()
export class MessageEngagementService {
  private readonly logger = new Logger(MessageEngagementService.name);

  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly messageCampaignStatisticsService: MessageCampaignStatisticsService,
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
    messageThreadId,
    receivedAt,
  }: RecordReplyArgs): Promise<void> {
    const normalizedSenderHandle = senderHandle.trim().toLowerCase();

    if (replyHeaderMessageIds.length === 0 || normalizedSenderHandle === '') {
      return;
    }

    const repliedAt = isNonEmptyString(receivedAt)
      ? new Date(receivedAt)
      : new Date();

    await this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const message =
        (await this.findRepliedCampaignMessageByHeader({
          replyHeaderMessageIds,
          senderHandle: normalizedSenderHandle,
        })) ??
        (await this.findRepliedCampaignMessageByThread({
          messageThreadId,
          senderHandle: normalizedSenderHandle,
          repliedAt,
        }));

      if (!isDefined(message) || !isDefined(message.messageCampaignId)) {
        return;
      }

      const campaignId = message.messageCampaignId;
      const messageRepository = this.workspaceOrmManager.getRepository(
        MessageWorkspaceEntity,
        { shouldBypassPermissionChecks: true },
      );

      await messageRepository.update(
        { id: message.id, repliedAt: IsNull() },
        { repliedAt },
      );

      this.logger.log(
        `Recorded reply to campaign ${campaignId} on message ${message.id}`,
      );

      await this.messageCampaignStatisticsService.scheduleRefresh({
        workspaceId,
        campaignId,
      });
    }, buildSystemAuthContext(workspaceId));
  }

  private async findRepliedCampaignMessageByHeader({
    replyHeaderMessageIds,
    senderHandle,
  }: {
    replyHeaderMessageIds: string[];
    senderHandle: string;
  }): Promise<MessageWorkspaceEntity | null> {
    const messageRepository = this.workspaceOrmManager.getRepository(
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
      return null;
    }

    // A campaign's Cc addresses are the same on every send and carry no
    // message of their own, so without this the Cc'd party answering any
    // recipient's email would be counted as that recipient replying.
    const recipientMessageIds = await this.findMessageIdsAddressedTo({
      messageIds: candidateMessages.map(({ id }) => id),
      handle: senderHandle,
    });

    // replyHeaderMessageIds is ordered most-specific first, so a reply deep in
    // a thread is attributed to the message it actually answers rather than to
    // whichever ancestor the database happened to return first.
    return (
      replyHeaderMessageIds
        .map((headerMessageId) =>
          candidateMessages.find(
            (candidate) =>
              candidate.headerMessageId === headerMessageId &&
              recipientMessageIds.has(candidate.id),
          ),
        )
        .find(isDefined) ?? null
    );
  }

  // A connected-account send stores the Message-ID the composer generated,
  // while the provider puts its own on the wire, so a reply's In-Reply-To names
  // an id no campaign message carries and header matching cannot succeed. The
  // provider still threads the reply with the message it answers, so the thread
  // is what connects them. Same identification the reply backfill command uses.
  private async findRepliedCampaignMessageByThread({
    messageThreadId,
    senderHandle,
    repliedAt,
  }: {
    messageThreadId?: string;
    senderHandle: string;
    repliedAt: Date;
  }): Promise<MessageWorkspaceEntity | null> {
    if (!isNonEmptyString(messageThreadId)) {
      return null;
    }

    const messageRepository = this.workspaceOrmManager.getRepository(
      MessageWorkspaceEntity,
      { shouldBypassPermissionChecks: true },
    );

    const campaignMessages = await messageRepository.find({
      where: {
        messageThreadId,
        messageCampaignId: Not(IsNull()),
        repliedAt: IsNull(),
      },
      order: { receivedAt: 'DESC' },
    });

    if (campaignMessages.length === 0) {
      return null;
    }

    const recipientMessageIds = await this.findMessageIdsAddressedTo({
      messageIds: campaignMessages.map(({ id }) => id),
      handle: senderHandle,
    });

    // Ordered newest first, so this answers the most recent campaign message in
    // the thread that was addressed to the sender and predates the reply.
    return (
      campaignMessages.find(
        (campaignMessage) =>
          recipientMessageIds.has(campaignMessage.id) &&
          isDefined(campaignMessage.receivedAt) &&
          campaignMessage.receivedAt < repliedAt,
      ) ?? null
    );
  }

  private async findMessageIdsAddressedTo({
    messageIds,
    handle,
  }: {
    messageIds: string[];
    handle: string;
  }): Promise<Set<string>> {
    const participantRepository = this.workspaceOrmManager.getRepository(
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

  // The mass-compose path signs its tokens before the campaign message row
  // exists, so the recipient participant is what resolves the message at hit
  // time. A hit that lands before the row is written is dropped rather than
  // retried: the pixel and the redirect must answer regardless.
  private async resolveCampaignMessageId({
    campaignId,
    messageId,
    personId,
  }: RecordEngagementArgs): Promise<string | null> {
    if (isDefined(messageId)) {
      return messageId;
    }

    if (!isDefined(personId)) {
      return null;
    }

    const participantRepository = this.workspaceOrmManager.getRepository(
      MessageParticipantWorkspaceEntity,
      { shouldBypassPermissionChecks: true },
    );

    const participant = await participantRepository.findOne({
      where: {
        messageCampaignId: campaignId,
        personId,
        role: MessageParticipantRole.TO,
      },
      order: { createdAt: 'DESC' },
    });

    return participant?.messageId ?? null;
  }

  private async record(
    args: RecordEngagementArgs,
    { isClick }: { isClick: boolean },
  ): Promise<void> {
    const { workspaceId, campaignId } = args;

    await this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const messageRepository = this.workspaceOrmManager.getRepository(
        MessageWorkspaceEntity,
        { shouldBypassPermissionChecks: true },
      );

      const messageId = await this.resolveCampaignMessageId(args);

      if (!isDefined(messageId)) {
        this.logger.warn(
          `Discarded tracking hit for campaign ${campaignId}: no message matches person ${args.personId}`,
        );

        return;
      }

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

      await this.messageCampaignStatisticsService.scheduleRefresh({
        workspaceId,
        campaignId,
      });
    }, buildSystemAuthContext(workspaceId));
  }
}
