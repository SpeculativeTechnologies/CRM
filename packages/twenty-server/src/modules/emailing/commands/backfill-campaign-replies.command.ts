import { Command } from 'nest-commander';

import chunk from 'lodash.chunk';
import { MessageParticipantRole } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { In, IsNull, MoreThan, Not } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { MessageCampaignStatisticsService } from 'src/modules/emailing/services/message-campaign-statistics.service';
import { MessageParticipantWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-participant.workspace-entity';
import { MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';

const CAMPAIGN_MESSAGE_BATCH_SIZE = 500;
const QUERY_CHUNK_SIZE = 500;

type CampaignMessage = {
  id: string;
  messageCampaignId: string | null;
  messageThreadId: string | null;
  receivedAt: Date | null;
};

const normalizeHandle = (handle: string | null): string | null =>
  isDefined(handle) && handle.trim() !== ''
    ? handle.trim().toLowerCase()
    : null;

@Command({
  name: 'emailing:backfill-campaign-replies',
  description:
    'Stamp repliedAt on campaign messages whose replies were imported before reply attribution reached the mailbox sync path',
})
export class BackfillCampaignRepliesCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly messageCampaignStatisticsService: MessageCampaignStatisticsService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    const stampedCampaignIds =
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => this.backfillWorkspace(workspaceId, isDryRun),
        buildSystemAuthContext(workspaceId),
      );

    if (stampedCampaignIds.size === 0) {
      this.logger.log(`No unattributed campaign replies in ${workspaceId}`);

      return;
    }

    if (isDryRun) {
      return;
    }

    for (const campaignId of stampedCampaignIds) {
      await this.messageCampaignStatisticsService.refreshCampaignCounts({
        workspaceId,
        campaignId,
      });
    }
  }

  // Batched on an ascending id cursor rather than read in one go, so a workspace
  // with a long campaign history does not have to fit in memory. Stamping only
  // removes rows from the filter, so the cursor never has to revisit a batch.
  private async backfillWorkspace(
    workspaceId: string,
    isDryRun: boolean,
  ): Promise<Set<string>> {
    const messageRepository =
      await this.globalWorkspaceOrmManager.getRepository(
        workspaceId,
        MessageWorkspaceEntity,
        { shouldBypassPermissionChecks: true },
      );

    const stampedCampaignIds = new Set<string>();
    let cursor: string | null = null;

    for (;;) {
      const campaignMessages: CampaignMessage[] = await messageRepository.find({
        where: {
          messageCampaignId: Not(IsNull()),
          repliedAt: IsNull(),
          messageThreadId: Not(IsNull()),
          ...(cursor === null ? {} : { id: MoreThan(cursor) }),
        },
        select: {
          id: true,
          messageCampaignId: true,
          messageThreadId: true,
          receivedAt: true,
        },
        order: { id: 'ASC' },
        take: CAMPAIGN_MESSAGE_BATCH_SIZE,
      });

      if (campaignMessages.length === 0) {
        return stampedCampaignIds;
      }

      cursor = campaignMessages[campaignMessages.length - 1].id;

      const batchCampaignIds = await this.backfillBatch({
        workspaceId,
        campaignMessages,
        isDryRun,
      });

      for (const campaignId of batchCampaignIds) {
        stampedCampaignIds.add(campaignId);
      }
    }
  }

  // Imported messages do not keep their headers, so a reply is identified the
  // only way the stored rows allow: a later message in the campaign message
  // thread, sent by one of the people that message was addressed to. Without
  // headers an out-of-office is indistinguishable from a written answer, so
  // unlike the live attribution path this does count auto-replies.
  private async backfillBatch({
    workspaceId,
    campaignMessages,
    isDryRun,
  }: {
    workspaceId: string;
    campaignMessages: CampaignMessage[];
    isDryRun: boolean;
  }): Promise<Set<string>> {
    const messageRepository =
      await this.globalWorkspaceOrmManager.getRepository(
        workspaceId,
        MessageWorkspaceEntity,
        { shouldBypassPermissionChecks: true },
      );

    const stampedCampaignIds = new Set<string>();

    const recipientHandlesByMessageId = await this.loadHandlesByMessageId({
      workspaceId,
      messageIds: campaignMessages.map(({ id }) => id),
      role: MessageParticipantRole.TO,
    });

    const threadIds = [
      ...new Set(
        campaignMessages.map(({ messageThreadId }) => messageThreadId),
      ),
    ].filter(isDefined);

    const threadMessages = (
      await Promise.all(
        chunk(threadIds, QUERY_CHUNK_SIZE).map((threadIdChunk) =>
          messageRepository.find({
            where: {
              messageThreadId: In(threadIdChunk),
              messageCampaignId: IsNull(),
            },
            select: { id: true, messageThreadId: true, receivedAt: true },
          }),
        ),
      )
    ).flat();

    if (threadMessages.length === 0) {
      return stampedCampaignIds;
    }

    const senderHandlesByMessageId = await this.loadHandlesByMessageId({
      workspaceId,
      messageIds: threadMessages.map(({ id }) => id),
      role: MessageParticipantRole.FROM,
    });

    for (const campaignMessage of campaignMessages) {
      const recipientHandles = recipientHandlesByMessageId.get(
        campaignMessage.id,
      );
      const sentAt = campaignMessage.receivedAt;
      const campaignId = campaignMessage.messageCampaignId;

      if (
        !isDefined(recipientHandles) ||
        !isDefined(sentAt) ||
        !isDefined(campaignId)
      ) {
        continue;
      }

      const repliedAt = threadMessages
        .filter(
          (threadMessage) =>
            threadMessage.messageThreadId === campaignMessage.messageThreadId &&
            isDefined(threadMessage.receivedAt) &&
            threadMessage.receivedAt > sentAt &&
            [...(senderHandlesByMessageId.get(threadMessage.id) ?? [])].some(
              (handle) => recipientHandles.has(handle),
            ),
        )
        .map(({ receivedAt }) => receivedAt)
        .filter(isDefined)
        .sort((first, second) => first.getTime() - second.getTime())[0];

      if (!isDefined(repliedAt)) {
        continue;
      }

      this.logger.log(
        `${isDryRun ? 'Would stamp' : 'Stamping'} reply on message ${campaignMessage.id} of campaign ${campaignId}`,
      );

      stampedCampaignIds.add(campaignId);

      if (!isDryRun) {
        await messageRepository.update(
          { id: campaignMessage.id, repliedAt: IsNull() },
          { repliedAt },
        );
      }
    }

    return stampedCampaignIds;
  }

  private async loadHandlesByMessageId({
    workspaceId,
    messageIds,
    role,
  }: {
    workspaceId: string;
    messageIds: string[];
    role: MessageParticipantRole;
  }): Promise<Map<string, Set<string>>> {
    const participantRepository =
      await this.globalWorkspaceOrmManager.getRepository(
        workspaceId,
        MessageParticipantWorkspaceEntity,
        { shouldBypassPermissionChecks: true },
      );

    const participants = (
      await Promise.all(
        chunk(messageIds, QUERY_CHUNK_SIZE).map((messageIdChunk) =>
          participantRepository.find({
            where: { messageId: In(messageIdChunk), role },
            select: { messageId: true, handle: true },
          }),
        ),
      )
    ).flat();

    const handlesByMessageId = new Map<string, Set<string>>();

    for (const participant of participants) {
      const handle = normalizeHandle(participant.handle);

      if (!isDefined(handle)) {
        continue;
      }

      const handles =
        handlesByMessageId.get(participant.messageId) ?? new Set<string>();

      handles.add(handle);
      handlesByMessageId.set(participant.messageId, handles);
    }

    return handlesByMessageId;
  }
}
