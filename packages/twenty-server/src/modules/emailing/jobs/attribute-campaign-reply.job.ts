import { ATTRIBUTE_CAMPAIGN_REPLY_JOB } from 'src/engine/core-modules/emailing-domain/constants/campaign.constant';
import { type AttributeCampaignReplyJobData } from 'src/engine/core-modules/emailing-domain/types/attribute-campaign-reply-job-data.type';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageEngagementService } from 'src/modules/emailing/services/message-engagement.service';

@Processor(MessageQueue.emailQueue)
export class AttributeCampaignReplyJob {
  constructor(
    private readonly messageEngagementService: MessageEngagementService,
  ) {}

  @Process(ATTRIBUTE_CAMPAIGN_REPLY_JOB)
  async handle(data: AttributeCampaignReplyJobData): Promise<void> {
    await this.messageEngagementService.recordReply({
      workspaceId: data.workspaceId,
      replyHeaderMessageIds: data.replyHeaderMessageIds,
      senderHandle: data.senderHandle,
    });
  }
}
