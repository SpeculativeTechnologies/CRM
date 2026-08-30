import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isNonEmptyString } from '@sniptt/guards';
import {
  MessageChannelType,
  MessageParticipantRole,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { Repository } from 'typeorm';

import { ATTRIBUTE_CAMPAIGN_REPLY_JOB } from 'src/engine/core-modules/emailing-domain/constants/campaign.constant';
import { type AttributeCampaignReplyJobData } from 'src/engine/core-modules/emailing-domain/types/attribute-campaign-reply-job-data.type';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { InboundEmailMessageSourceResolverService } from 'src/modules/messaging/message-import-manager/drivers/inbound-email/sources/inbound-email-message-source-resolver.service';
import { type InboundEmailImportOutcome } from 'src/modules/messaging/message-import-manager/drivers/inbound-email/types/inbound-email-import-outcome.type';
import { type InboundEmailMessageReference } from 'src/modules/messaging/message-import-manager/drivers/inbound-email/types/inbound-email-message-reference.type';
import { MessagingSaveMessagesAndEnqueueContactCreationService } from 'src/modules/messaging/message-import-manager/services/messaging-save-messages-and-enqueue-contact-creation.service';
import { type MessageWithParticipants } from 'src/modules/messaging/message-import-manager/types/message';
import { extractReplyHeaderMessageIds } from 'src/modules/messaging/message-import-manager/utils/extract-reply-header-message-ids.util';
import { isAutoReplyMessage } from 'src/modules/messaging/message-import-manager/utils/is-auto-reply-message.util';

type ImportInboundMessageParams = {
  messageReference: InboundEmailMessageReference;
  envelopeRecipients: string[];
};

@Injectable()
export class InboundEmailImportService {
  private readonly logger = new Logger(InboundEmailImportService.name);

  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly inboundEmailMessageSourceResolverService: InboundEmailMessageSourceResolverService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly messagingSaveMessagesAndEnqueueContactCreationService: MessagingSaveMessagesAndEnqueueContactCreationService,
    @InjectRepository(MessageChannelEntity)
    private readonly messageChannelRepository: Repository<MessageChannelEntity>,
    @InjectRepository(ConnectedAccountEntity)
    private readonly connectedAccountRepository: Repository<ConnectedAccountEntity>,
    @InjectMessageQueue(MessageQueue.emailQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  async importInboundMessage(
    params: ImportInboundMessageParams,
  ): Promise<InboundEmailImportOutcome> {
    const { messageReference, envelopeRecipients } = params;

    const inboundEmailDomain = this.twentyConfigService.get(
      'INBOUND_EMAIL_DOMAIN',
    );

    if (!isNonEmptyString(inboundEmailDomain)) {
      this.logger.warn(
        `Skipping inbound email import for ${messageReference.reference}: email group is not configured.`,
      );

      return { kind: 'unconfigured' };
    }

    const messageSource = this.inboundEmailMessageSourceResolverService.resolve(
      messageReference.source,
    );

    if (!messageSource.isConfigured()) {
      this.logger.warn(
        `Skipping inbound email import for ${messageReference.reference}: message source ${messageReference.source} is not configured.`,
      );

      return { kind: 'unconfigured' };
    }

    const recipient = this.matchInboundRecipient(
      envelopeRecipients,
      inboundEmailDomain,
    );

    if (!isDefined(recipient)) {
      this.logger.warn(
        `No recipient at ${inboundEmailDomain} in inbound notification for ${messageReference.reference}`,
      );

      return { kind: 'unmatched', recipient: null };
    }

    const messageChannel = await this.messageChannelRepository.findOne({
      where: { handle: recipient, type: MessageChannelType.EMAIL_GROUP },
    });

    if (!isDefined(messageChannel)) {
      this.logger.warn(
        `No email group channel matches recipient ${recipient} (reference ${messageReference.reference})`,
      );

      return { kind: 'unmatched', recipient };
    }

    const message = await messageSource.fetchMessage(
      messageReference.reference,
    );

    const { workspaceId } = messageChannel;

    const connectedAccount = await this.connectedAccountRepository.findOne({
      where: { id: messageChannel.connectedAccountId, workspaceId },
    });

    if (!isDefined(connectedAccount)) {
      throw new Error(
        `Email group channel ${messageChannel.id} has no connected account`,
      );
    }

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        await this.messagingSaveMessagesAndEnqueueContactCreationService.saveMessagesAndEnqueueContactCreation(
          [message],
          messageChannel,
          connectedAccount,
          workspaceId,
        );
      },
      buildSystemAuthContext(workspaceId),
      { lite: true },
    );

    await this.enqueueCampaignReplyAttribution(message, workspaceId);

    await messageSource.cleanup(messageReference.reference);

    return {
      kind: 'imported',
      workspaceId,
      messageChannelId: messageChannel.id,
    };
  }

  // Attribution runs on the email queue rather than inline: the campaign lookup
  // is unrelated to importing the message, and must not fail the import.
  private async enqueueCampaignReplyAttribution(
    message: MessageWithParticipants,
    workspaceId: string,
  ): Promise<void> {
    const headers = message.messageHeaders ?? [];
    const replyHeaderMessageIds = extractReplyHeaderMessageIds(headers);
    const senderHandle = message.participants.find(
      ({ role }) => role === MessageParticipantRole.FROM,
    )?.handle;

    if (replyHeaderMessageIds.length === 0 || !isNonEmptyString(senderHandle)) {
      return;
    }

    // An out-of-office answers the campaign message's In-Reply-To just as a
    // human would, and counting it would inflate reply rate the same way image
    // prefetching inflates opens.
    if (isAutoReplyMessage(headers)) {
      this.logger.log(
        `Not counting auto-reply ${message.headerMessageId} as a campaign reply`,
      );

      return;
    }

    await this.messageQueueService.add<AttributeCampaignReplyJobData>(
      ATTRIBUTE_CAMPAIGN_REPLY_JOB,
      { workspaceId, replyHeaderMessageIds, senderHandle },
    );
  }

  private matchInboundRecipient(
    envelopeRecipients: string[],
    inboundEmailDomain: string,
  ): string | null {
    const normalizedDomain = inboundEmailDomain.toLowerCase();

    return (
      envelopeRecipients
        .map((address) => address.toLowerCase())
        .find((address) => address.endsWith(`@${normalizedDomain}`)) ?? null
    );
  }
}
