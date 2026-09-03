import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type Type,
} from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import {
  MessageCampaignStatus,
  MessageParticipantRole,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { In, type ObjectLiteral } from 'typeorm';
import { v4 } from 'uuid';

import { buildCreatedByFromFullNameMetadata } from 'src/engine/core-modules/actor/utils/build-created-by-from-full-name-metadata.util';
import { compileOutboundEmailContent } from 'src/engine/core-modules/email/utils/compile-outbound-email-content.util';
import { CampaignDeliveryEntity } from 'src/engine/core-modules/emailing-domain/campaign-delivery.entity';
import { CAMPAIGN_DELIVERY_STATE } from 'src/engine/core-modules/emailing-domain/constants/campaign-delivery-state.constant';
import { CAMPAIGN_FAILURE_REASON } from 'src/engine/core-modules/emailing-domain/constants/campaign-failure-reason.constant';
import { EmailingDomainStatus } from 'src/engine/core-modules/emailing-domain/drivers/types/emailing-domain-status.type';
import { UnsubscribeHostnameStatus } from 'src/engine/core-modules/emailing-domain/drivers/types/unsubscribe-hostname-status.type';
import { EmailingDomainEntity } from 'src/engine/core-modules/emailing-domain/emailing-domain.entity';
import { type RawCampaignRecipient } from 'src/engine/core-modules/emailing-domain/types/raw-campaign-recipient.type';
import { UserRoleService } from 'src/engine/metadata-modules/user-role/user-role.service';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import { MessageCampaignStatisticsService } from 'src/modules/emailing/services/message-campaign-statistics.service';
import { MessageCampaignWorkspaceEntity } from 'src/modules/emailing/standard-objects/message-campaign.workspace-entity';
import { MessageListMemberWorkspaceEntity } from 'src/modules/emailing/standard-objects/message-list-member.workspace-entity';
import { MessageListWorkspaceEntity } from 'src/modules/emailing/standard-objects/message-list.workspace-entity';
import { assertCampaignDraftOwnedBy } from 'src/modules/emailing/utils/assert-campaign-draft-owned-by.util';
import { buildCampaignMessageId } from 'src/modules/emailing/utils/build-campaign-message-id.util';
import { computeCampaignTerminalStatus } from 'src/modules/emailing/utils/compute-campaign-terminal-status.util';
import { MessageParticipantWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-participant.workspace-entity';
import { MessageThreadWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-thread.workspace-entity';
import { MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';
import { getDomainFromEmail } from 'src/utils/get-domain-from-email';

type SaveCampaignDraftArgs = {
  workspaceId: string;
  userWorkspaceId: string;
  workspaceMemberId: string;
  campaignId?: string;
  listId?: string | null;
  unsubscribeTopicId?: string | null;
  subject?: string | null;
  body?: string | null;
  fromAddress?: string | null;
};

export type MassEmailCampaignSendOutcome = {
  personId: string;
  email: string;
  subject: string;
  body: string;
  cc?: string[];
  success: boolean;
  messageId?: string;
};

const MASS_EMAIL_RECIPIENT_LIST_PREFIX = 'Selected people (';

// Fork-owned campaign authoring: creator-scoped drafts and the mass-compose
// path that sends through a connected mailbox instead of an emailing domain.
// Kept out of MessageCampaignService so upstream refactors of the campaign
// pipeline do not collide with it.
@Injectable()
export class MessageCampaignAuthoringService {
  private readonly logger = new Logger(MessageCampaignAuthoringService.name);

  constructor(
    @InjectWorkspaceScopedRepository(EmailingDomainEntity)
    private readonly emailingDomainRepository: WorkspaceScopedRepository<EmailingDomainEntity>,
    @InjectWorkspaceScopedRepository(CampaignDeliveryEntity)
    private readonly campaignDeliveryRepository: WorkspaceScopedRepository<CampaignDeliveryEntity>,
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly userRoleService: UserRoleService,
    private readonly messageCampaignStatisticsService: MessageCampaignStatisticsService,
  ) {}

  async saveDraft({
    workspaceId,
    userWorkspaceId,
    workspaceMemberId,
    campaignId,
    listId,
    unsubscribeTopicId,
    subject,
    body,
    fromAddress,
  }: SaveCampaignDraftArgs): Promise<{ campaignId: string; updatedAt: Date }> {
    const roleId = await this.userRoleService.getRoleIdForUserWorkspace({
      workspaceId,
      userWorkspaceId,
    });

    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const campaignRepository = this.workspaceOrmManager.getRepository(
        MessageCampaignWorkspaceEntity,
        { unionOf: [roleId] },
      );
      const now = new Date();
      const campaignValues = {
        subject: subject?.trim().length ? subject : null,
        bodyTemplate: body?.length ? body : null,
        fromAddress: fromAddress?.trim().length
          ? {
              primaryEmail: fromAddress.trim(),
              additionalEmails: null,
            }
          : null,
        listId: listId ?? null,
        unsubscribeTopicId: unsubscribeTopicId ?? null,
      };

      if (!isDefined(campaignId)) {
        const createdCampaignId = v4();

        await campaignRepository.insert({
          id: createdCampaignId,
          ...campaignValues,
          status: MessageCampaignStatus.DRAFT,
          createdBy: await this.buildCreatedBy(workspaceMemberId),
        });

        return { campaignId: createdCampaignId, updatedAt: now };
      }

      const campaign = await campaignRepository.findOne({
        where: { id: campaignId },
      });

      assertCampaignDraftOwnedBy(campaign, workspaceMemberId);

      await campaignRepository.update({ id: campaignId }, campaignValues);

      return { campaignId, updatedAt: now };
    });
  }

  async deleteDraft({
    workspaceId,
    userWorkspaceId,
    workspaceMemberId,
    campaignId,
  }: {
    workspaceId: string;
    userWorkspaceId: string;
    workspaceMemberId: string;
    campaignId: string;
  }): Promise<boolean> {
    const roleId = await this.userRoleService.getRoleIdForUserWorkspace({
      workspaceId,
      userWorkspaceId,
    });

    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const campaignRepository = this.workspaceOrmManager.getRepository(
        MessageCampaignWorkspaceEntity,
        { unionOf: [roleId] },
      );
      const campaign = await campaignRepository.findOne({
        where: { id: campaignId },
      });

      assertCampaignDraftOwnedBy(campaign, workspaceMemberId);

      await campaignRepository.softDelete({ id: campaignId });

      return true;
    });
  }

  async saveMassEmailDraft({
    workspaceId,
    userWorkspaceId,
    workspaceMemberId,
    campaignId,
    personIds,
    subject,
    body,
    cc,
    fromAddress,
  }: {
    workspaceId: string;
    userWorkspaceId: string;
    workspaceMemberId: string;
    campaignId?: string;
    personIds: string[];
    subject?: string | null;
    body?: string | null;
    cc?: string[] | null;
    fromAddress: string;
  }): Promise<{ campaignId: string; updatedAt: Date }> {
    const roleId = await this.userRoleService.getRoleIdForUserWorkspace({
      workspaceId,
      userWorkspaceId,
    });

    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const uniquePersonIds = [...new Set(personIds)];
      const accessibleRecipients = await this.loadRecipientsByPersonIds(
        uniquePersonIds,
        roleId,
      );

      if (accessibleRecipients.length !== uniquePersonIds.length) {
        throw new ForbiddenException(
          'One or more campaign recipients are not accessible',
        );
      }

      const campaignRepository = this.getSystemRepository(
        MessageCampaignWorkspaceEntity,
      );
      const listRepository = this.getSystemRepository(
        MessageListWorkspaceEntity,
      );
      const listMemberRepository = this.getSystemRepository(
        MessageListMemberWorkspaceEntity,
      );
      const existingCampaign = isDefined(campaignId)
        ? await campaignRepository.findOne({
            where: { id: campaignId },
            relations: { list: true },
          })
        : null;

      if (isDefined(campaignId)) {
        assertCampaignDraftOwnedBy(existingCampaign, workspaceMemberId);
      }

      const existingListIsMassEmailList =
        existingCampaign?.list?.name?.startsWith(
          MASS_EMAIL_RECIPIENT_LIST_PREFIX,
        ) === true;
      let recipientListId = existingListIsMassEmailList
        ? existingCampaign.listId
        : null;
      const listName = `${MASS_EMAIL_RECIPIENT_LIST_PREFIX}${uniquePersonIds.length})`;

      if (recipientListId === null) {
        recipientListId = v4();

        await listRepository.insert({ id: recipientListId, name: listName });
      } else {
        await listRepository.update(
          { id: recipientListId },
          { name: listName },
        );
        await listMemberRepository.delete({ listId: recipientListId });
      }

      await listMemberRepository.insert(
        uniquePersonIds.map((personId) => ({
          listId: recipientListId as string,
          personId,
        })),
      );

      const now = new Date();
      const ccAddresses = (cc ?? [])
        .map((ccAddress) => ccAddress.trim())
        .filter((ccAddress) => ccAddress.length > 0);
      const campaignValues = {
        subject: subject?.trim().length ? subject : null,
        bodyTemplate: body?.length ? body : null,
        ccAddresses: ccAddresses.length > 0 ? ccAddresses.join(', ') : null,
        fromAddress: {
          primaryEmail: fromAddress.trim(),
          additionalEmails: null,
        },
        listId: recipientListId,
      };

      if (existingCampaign !== null) {
        await campaignRepository.update(
          { id: existingCampaign.id },
          campaignValues,
        );

        return { campaignId: existingCampaign.id, updatedAt: now };
      }

      const createdCampaignId = v4();

      await campaignRepository.insert({
        id: createdCampaignId,
        ...campaignValues,
        status: MessageCampaignStatus.DRAFT,
        createdBy: await this.buildCreatedBy(workspaceMemberId),
      });

      return { campaignId: createdCampaignId, updatedAt: now };
    });
  }

  async prepareMassEmailCampaignForSending({
    workspaceId,
    userWorkspaceId,
    workspaceMemberId,
    campaignId,
    recipients,
    fromAddress,
  }: {
    workspaceId: string;
    userWorkspaceId: string;
    workspaceMemberId: string;
    campaignId: string;
    recipients: Array<{ personId: string; email: string }>;
    fromAddress: string;
  }): Promise<void> {
    const roleId = await this.userRoleService.getRoleIdForUserWorkspace({
      workspaceId,
      userWorkspaceId,
    });

    await this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const campaignRepository = this.getSystemRepository(
        MessageCampaignWorkspaceEntity,
      );
      const campaign = await campaignRepository.findOne({
        where: { id: campaignId },
      });

      assertCampaignDraftOwnedBy(campaign, workspaceMemberId);

      if (campaign.listId === null) {
        throw new BadRequestException('Campaign draft has no recipients');
      }

      const listMemberRepository = this.getSystemRepository(
        MessageListMemberWorkspaceEntity,
      );
      const members = await listMemberRepository.find({
        where: { listId: campaign.listId },
      });
      const expectedPersonIds = new Set(
        members.map(({ personId }) => personId),
      );
      const suppliedPersonIds = new Set(
        recipients.map(({ personId }) => personId),
      );

      if (
        suppliedPersonIds.size !== recipients.length ||
        expectedPersonIds.size !== suppliedPersonIds.size ||
        [...expectedPersonIds].some(
          (personId) => !suppliedPersonIds.has(personId),
        )
      ) {
        throw new BadRequestException(
          'Campaign recipients changed after the draft was saved',
        );
      }

      const accessibleRecipients = await this.loadRecipientsByPersonIds(
        [...expectedPersonIds],
        roleId,
      );

      if (accessibleRecipients.length !== expectedPersonIds.size) {
        throw new ForbiddenException(
          'One or more campaign recipients are no longer accessible',
        );
      }

      const currentEmailByPersonId = new Map(
        accessibleRecipients.map(({ personId, email }) => [
          personId,
          email?.trim().toLowerCase() ?? null,
        ]),
      );
      const recipientEmailChanged = recipients.some(
        ({ personId, email }) =>
          currentEmailByPersonId.get(personId) !== email.trim().toLowerCase(),
      );

      if (recipientEmailChanged) {
        throw new BadRequestException(
          'A campaign recipient email changed after the draft was saved',
        );
      }

      await campaignRepository.update(
        { id: campaignId },
        {
          status: MessageCampaignStatus.SENDING,
          fromAddress: {
            primaryEmail: fromAddress,
            additionalEmails: null,
          },
        },
      );
    });
  }

  // Recorded per recipient as the send loop advances, so an interrupted batch
  // still leaves the delivered recipients tracked on the campaign.
  async recordMassEmailCampaignSendOutcome({
    workspaceId,
    campaignId,
    fromAddress,
    outcome,
  }: {
    workspaceId: string;
    campaignId: string;
    fromAddress: string;
    outcome: MassEmailCampaignSendOutcome;
  }): Promise<void> {
    try {
      await this.workspaceOrmManager.executeInWorkspaceContext(async () => {
        await this.recordMassEmailCampaignOutcome({
          workspaceId,
          campaignId,
          fromAddress,
          outcome,
        });
      });
    } catch (error) {
      // The email is already out, so a bookkeeping failure must not abort the
      // remaining recipients or the campaign's terminal status.
      this.logger.error(
        `Failed to record campaign ${campaignId} outcome for ${outcome.email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async finalizeMassEmailCampaign({
    workspaceId,
    campaignId,
    workspaceMemberId,
    outcomes,
  }: {
    workspaceId: string;
    campaignId: string;
    workspaceMemberId: string;
    outcomes: MassEmailCampaignSendOutcome[];
  }): Promise<void> {
    await this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const campaignRepository = this.getSystemRepository(
        MessageCampaignWorkspaceEntity,
      );
      const campaign = await campaignRepository.findOne({
        where: { id: campaignId },
      });

      if (!isDefined(campaign)) {
        throw new NotFoundException('Campaign not found');
      }

      if (campaign.createdBy.workspaceMemberId !== workspaceMemberId) {
        throw new ForbiddenException(
          'Only the campaign creator can complete it',
        );
      }

      const failedCount = outcomes.filter(({ success }) => !success).length;

      await campaignRepository.update(
        { id: campaignId },
        {
          status: computeCampaignTerminalStatus({
            totalCount: outcomes.length,
            inProgressCount: 0,
            failedCount,
            skippedCount: 0,
          }),
          sentAt: new Date(),
        },
      );
    });

    // The counters come from the delivery rows written per outcome, which is
    // also where engagement lands, so a mass campaign's numbers normalise onto
    // the same source as a regular one.
    await this.messageCampaignStatisticsService.refreshCampaignCounts({
      workspaceId,
      campaignId,
    });
  }

  // Open and click tracking on the mass-compose path reuses the emailing
  // domain's unsubscribe hostname, the only host the workspace has already
  // pointed at this instance. A workspace that has not set one up sends
  // untracked rather than not at all.
  async resolveCampaignTrackingBaseUrl({
    workspaceId,
    fromAddress,
  }: {
    workspaceId: string;
    fromAddress: string;
  }): Promise<string | null> {
    const fromDomain = getDomainFromEmail(fromAddress)?.toLowerCase();

    if (!isNonEmptyString(fromDomain)) {
      return null;
    }

    const emailingDomain = await this.emailingDomainRepository.findOne(
      workspaceId,
      { where: { domain: fromDomain, status: EmailingDomainStatus.VERIFIED } },
    );

    if (
      !isDefined(emailingDomain) ||
      emailingDomain.unsubscribeHostnameStatus !==
        UnsubscribeHostnameStatus.ACTIVE ||
      !isNonEmptyString(emailingDomain.unsubscribeHostname)
    ) {
      this.logger.warn(
        `Sending campaign from ${fromAddress} without engagement tracking: no verified emailing domain with an active unsubscribe hostname`,
      );

      return null;
    }

    return `https://${emailingDomain.unsubscribeHostname}`;
  }

  private async recordMassEmailCampaignOutcome({
    workspaceId,
    campaignId,
    fromAddress,
    outcome,
  }: {
    workspaceId: string;
    campaignId: string;
    fromAddress: string;
    outcome: MassEmailCampaignSendOutcome;
  }): Promise<void> {
    const messageRepository = this.getSystemRepository(MessageWorkspaceEntity);
    const participantRepository = this.getSystemRepository(
      MessageParticipantWorkspaceEntity,
    );
    const persistedMessage = isDefined(outcome.messageId)
      ? await messageRepository.findOne({ where: { id: outcome.messageId } })
      : null;

    if (persistedMessage !== null) {
      await messageRepository.update(
        { id: persistedMessage.id },
        { messageCampaignId: campaignId },
      );

      const toParticipants = await participantRepository.find({
        where: {
          messageId: persistedMessage.id,
          role: MessageParticipantRole.TO,
        },
      });

      for (const participant of toParticipants) {
        await participantRepository.update(
          { id: participant.id },
          {
            personId: outcome.personId,
            messageCampaignId: campaignId,
          },
        );
      }

      await this.upsertMassEmailDelivery({
        workspaceId,
        campaignId,
        deliveryId: persistedMessage.id,
        outcome,
      });

      return;
    }

    const messageId = buildCampaignMessageId({
      campaignId,
      personId: outcome.personId,
    });
    const existingTrackingMessage = await messageRepository.findOne({
      where: { id: messageId },
    });

    if (existingTrackingMessage === null) {
      const threadId = v4();
      const threadRepository = this.getSystemRepository(
        MessageThreadWorkspaceEntity,
      );

      const { plainText } = await compileOutboundEmailContent(outcome.body);

      await threadRepository.insert({ id: threadId });
      await messageRepository.insert({
        id: messageId,
        headerMessageId: v4(),
        subject: outcome.subject,
        text: plainText,
        receivedAt: new Date(),
        messageThreadId: threadId,
        messageCampaignId: campaignId,
        isDraft: false,
      });
      await participantRepository.insert([
        {
          id: v4(),
          messageId,
          role: MessageParticipantRole.FROM,
          handle: fromAddress,
          displayName: fromAddress,
        },
        {
          id: v4(),
          messageId,
          role: MessageParticipantRole.TO,
          handle: outcome.email,
          displayName: outcome.email,
          personId: outcome.personId,
          messageCampaignId: campaignId,
        },
        // Cc'd people are not campaign recipients, so they carry no
        // messageCampaignId and stay out of the per-recipient delivery stats.
        ...(outcome.cc ?? []).map((ccHandle) => ({
          id: v4(),
          messageId,
          role: MessageParticipantRole.CC,
          handle: ccHandle,
          displayName: ccHandle,
        })),
      ]);
    }

    await this.upsertMassEmailDelivery({
      workspaceId,
      campaignId,
      deliveryId: messageId,
      outcome,
    });
  }

  // The mass-compose path sends synchronously through the mailbox, so each
  // delivery row is written already settled instead of going through the
  // queued/claimed states of the emailing-domain pipeline.
  private async upsertMassEmailDelivery({
    workspaceId,
    campaignId,
    deliveryId,
    outcome,
  }: {
    workspaceId: string;
    campaignId: string;
    deliveryId: string;
    outcome: MassEmailCampaignSendOutcome;
  }): Promise<void> {
    await this.campaignDeliveryRepository.upsert(
      workspaceId,
      [
        {
          id: deliveryId,
          campaignId,
          personId: outcome.personId,
          recipientEmail: outcome.email,
          state: outcome.success
            ? CAMPAIGN_DELIVERY_STATE.SENT
            : CAMPAIGN_DELIVERY_STATE.FAILED,
          failureReason: outcome.success
            ? null
            : CAMPAIGN_FAILURE_REASON.UNKNOWN,
          sentAt: outcome.success ? new Date() : null,
        },
      ],
      { conflictPaths: ['id'] },
    );
  }

  private async buildCreatedBy(workspaceMemberId: string) {
    const workspaceMemberRepository = this.getSystemRepository(
      WorkspaceMemberWorkspaceEntity,
    );
    const workspaceMember = await workspaceMemberRepository.findOne({
      where: { id: workspaceMemberId },
    });

    if (workspaceMember === null) {
      throw new NotFoundException('Workspace member not found');
    }

    return buildCreatedByFromFullNameMetadata({
      workspaceMemberId,
      fullNameMetadata: workspaceMember.name,
    });
  }

  private async loadRecipientsByPersonIds(
    personIds: string[],
    roleId: string,
  ): Promise<RawCampaignRecipient[]> {
    if (personIds.length === 0) {
      return [];
    }

    const personRepository = this.workspaceOrmManager.getRepository(
      PersonWorkspaceEntity,
      { unionOf: [roleId] },
    );

    const people = await personRepository.find({
      where: { id: In(personIds) },
    });

    return people.map((person) => ({
      personId: person.id,
      email: person.emails?.primaryEmail ?? null,
    }));
  }

  private getSystemRepository<T extends ObjectLiteral>(entity: Type<T>) {
    return this.workspaceOrmManager.getRepository(entity, {
      shouldBypassPermissionChecks: true,
    });
  }
}
