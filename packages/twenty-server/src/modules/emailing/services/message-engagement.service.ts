import { Injectable, Logger } from '@nestjs/common';

import { IsNull } from 'typeorm';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { CampaignStatsRefreshSchedulerService } from 'src/modules/emailing/services/campaign-stats-refresh-scheduler.service';
import { MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';

type RecordEngagementArgs = {
  workspaceId: string;
  campaignId: string;
  messageId: string;
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
