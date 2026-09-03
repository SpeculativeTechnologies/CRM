import { Injectable, NotFoundException, type Type } from '@nestjs/common';

import { In, type ObjectLiteral } from 'typeorm';
import {
  MessageCampaignStatus,
  MessageParticipantRole,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { CampaignDeliveryEntity } from 'src/engine/core-modules/emailing-domain/campaign-delivery.entity';
import { MessageCampaignDetailsDTO } from 'src/engine/core-modules/emailing-domain/dtos/message-campaign-details.dto';
import { MessageCampaignSummaryDTO } from 'src/engine/core-modules/emailing-domain/dtos/message-campaign-summary.dto';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import { MessageCampaignWorkspaceEntity } from 'src/modules/emailing/standard-objects/message-campaign.workspace-entity';
import { MessageListMemberWorkspaceEntity } from 'src/modules/emailing/standard-objects/message-list-member.workspace-entity';
import { renderCampaignTemplate } from 'src/modules/emailing/utils/render-campaign-template.util';
import { MessageParticipantWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-participant.workspace-entity';
import { MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

@Injectable()
export class MessageCampaignQueryService {
  constructor(
    @InjectWorkspaceScopedRepository(CampaignDeliveryEntity)
    private readonly campaignDeliveryRepository: WorkspaceScopedRepository<CampaignDeliveryEntity>,
    private readonly workspaceOrmManager: WorkspaceOrmManager,
  ) {}

  private getSystemRepository<T extends ObjectLiteral>(entity: Type<T>) {
    return this.workspaceOrmManager.getRepository(entity, {
      shouldBypassPermissionChecks: true,
    });
  }

  async findAll(): Promise<MessageCampaignSummaryDTO[]> {
    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const campaignRepository = this.getSystemRepository(
        MessageCampaignWorkspaceEntity,
      );
      const campaigns = await campaignRepository.find({
        order: { updatedAt: 'DESC' },
        relations: { list: true },
        take: 500,
      });

      const campaignIds = campaigns.map(({ id }) => id);
      const listIds = campaigns
        .map(({ listId }) => listId)
        .filter((listId): listId is string => listId !== null);
      const [messages, listMembers] = await Promise.all([
        campaignIds.length === 0
          ? []
          : this.getSystemRepository(MessageWorkspaceEntity).find({
              select: ['id', 'messageCampaignId'],
              where: { messageCampaignId: In(campaignIds) },
            }),
        listIds.length === 0
          ? []
          : this.getSystemRepository(MessageListMemberWorkspaceEntity).find({
              select: ['id', 'listId'],
              where: { listId: In(listIds) },
            }),
      ]);
      const recipientCounts = this.countBy(
        messages.map(({ messageCampaignId }) => messageCampaignId),
      );
      const draftAudienceCounts = this.countBy(
        listMembers.map(({ listId }) => listId),
      );

      return campaigns.map((campaign) =>
        this.toSummary(
          campaign,
          campaign.status === MessageCampaignStatus.DRAFT
            ? (draftAudienceCounts.get(campaign.listId ?? '') ?? 0)
            : (recipientCounts.get(campaign.id) ?? 0),
        ),
      );
    });
  }

  async findOne({
    workspaceId,
    campaignId,
    workspaceMemberId,
  }: {
    workspaceId: string;
    campaignId: string;
    workspaceMemberId: string;
  }): Promise<MessageCampaignDetailsDTO> {
    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const campaignRepository = this.getSystemRepository(
        MessageCampaignWorkspaceEntity,
      );
      const campaign = await campaignRepository.findOne({
        where: { id: campaignId },
        relations: { list: true },
      });

      if (campaign === null) {
        throw new NotFoundException('Campaign not found');
      }

      const participantRepository = this.getSystemRepository(
        MessageParticipantWorkspaceEntity,
      );
      const participants = await participantRepository.find({
        where: {
          messageCampaignId: campaignId,
          role: MessageParticipantRole.TO,
        },
        order: { createdAt: 'ASC' },
      });
      const messageIds = participants.map(({ messageId }) => messageId);
      const personIds = participants
        .map(({ personId }) => personId)
        .filter((personId): personId is string => personId !== null);
      const [messages, deliveries, people, draftAudience] = await Promise.all([
        messageIds.length === 0
          ? []
          : this.getSystemRepository(MessageWorkspaceEntity).find({
              where: { id: In(messageIds) },
            }),
        messageIds.length === 0
          ? []
          : this.campaignDeliveryRepository.find(workspaceId, {
              where: { campaignId, id: In(messageIds) },
            }),
        personIds.length === 0
          ? []
          : this.getSystemRepository(PersonWorkspaceEntity).find({
              where: { id: In(personIds) },
            }),
        campaign.status !== MessageCampaignStatus.DRAFT ||
        campaign.listId === null
          ? []
          : this.getSystemRepository(MessageListMemberWorkspaceEntity).find({
              select: ['personId'],
              where: { listId: campaign.listId as string },
            }),
      ]);
      const messagesById = new Map(
        messages.map((message) => [message.id, message]),
      );
      const deliveriesById = new Map(
        deliveries.map((delivery) => [delivery.id, delivery]),
      );
      const peopleById = new Map(people.map((person) => [person.id, person]));
      const recipients = participants.map((participant) => {
        const message = messagesById.get(participant.messageId);
        const person = participant.personId
          ? peopleById.get(participant.personId)
          : undefined;
        const personName = [person?.name?.firstName, person?.name?.lastName]
          .filter(Boolean)
          .join(' ');
        const variables = {
          firstName: person?.name?.firstName ?? '',
          lastName: person?.name?.lastName ?? '',
          fullName: personName,
          email: person?.emails?.primaryEmail ?? participant.handle ?? '',
        };

        return {
          messageId: participant.messageId,
          personId: participant.personId,
          displayName:
            personName ||
            participant.displayName ||
            participant.handle ||
            'Unknown recipient',
          email: participant.handle ?? '',
          deliveryStatus: this.toDeliveryStatus(
            deliveriesById.get(participant.messageId),
          ),
          openedAt: message?.openedAt ?? null,
          openCount: message?.openCount ?? 0,
          clickedAt: message?.clickedAt ?? null,
          clickCount: message?.clickCount ?? 0,
          repliedAt: message?.repliedAt ?? null,
          subject: renderCampaignTemplate(campaign.subject ?? '', variables, {
            escapeValues: false,
          }),
          body: renderCampaignTemplate(campaign.bodyTemplate ?? '', variables, {
            escapeValues: true,
          }),
        };
      });
      const recipientCount =
        campaign.status === MessageCampaignStatus.DRAFT
          ? draftAudience.length
          : recipients.length;

      return {
        ...this.toSummary(campaign, recipientCount),
        body: campaign.bodyTemplate,
        ccAddresses: campaign.ccAddresses ?? null,
        unsubscribeTopicId: campaign.unsubscribeTopicId,
        canEdit:
          campaign.status === MessageCampaignStatus.DRAFT &&
          campaign.createdBy.workspaceMemberId === workspaceMemberId,
        recipients,
        draftPersonIds: draftAudience.map(({ personId }) => personId),
      };
    });
  }

  // Per-recipient state lives on the core campaignDelivery row since upstream's
  // delivery refactor. Provider feedback is folded in so the recipient list
  // keeps showing bounces and complaints as it did before.
  private toDeliveryStatus(delivery: CampaignDeliveryEntity | undefined) {
    if (!isDefined(delivery)) {
      return 'QUEUED';
    }

    if (isDefined(delivery.complainedAt)) {
      return 'COMPLAINED';
    }

    if (isDefined(delivery.bouncedAt)) {
      return 'BOUNCED';
    }

    return delivery.state;
  }

  private toSummary(
    campaign: MessageCampaignWorkspaceEntity,
    recipientCount: number,
  ): MessageCampaignSummaryDTO {
    return {
      id: campaign.id,
      subject: campaign.subject,
      status: campaign.status,
      fromAddress: campaign.fromAddress?.primaryEmail ?? null,
      listId: campaign.listId,
      listName: campaign.list?.name ?? null,
      creatorWorkspaceMemberId: campaign.createdBy.workspaceMemberId ?? null,
      creatorName: campaign.createdBy.name || 'Unknown user',
      createdAt: new Date(campaign.createdAt),
      updatedAt: new Date(campaign.updatedAt),
      sentAt: campaign.sentAt === null ? null : new Date(campaign.sentAt),
      recipientCount,
      sentCount: campaign.sentCount,
      failedCount: campaign.failedCount,
      bouncedCount: campaign.bouncedCount,
      complainedCount: campaign.complainedCount,
      openedCount: campaign.openedCount,
      clickedCount: campaign.clickedCount,
      repliedCount: campaign.repliedCount,
    };
  }

  private countBy(values: Array<string | null>): Map<string, number> {
    return values.reduce((counts, value) => {
      if (value !== null) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }

      return counts;
    }, new Map<string, number>());
  }
}
