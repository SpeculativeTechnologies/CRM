import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceIteratorModule } from 'src/database/commands/command-runners/workspace-iterator.module';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { EmailingDomainModule } from 'src/engine/core-modules/emailing-domain/emailing-domain.module';
import { EmailingDomainEntity } from 'src/engine/core-modules/emailing-domain/emailing-domain.entity';
import { CampaignDeliveryEntity } from 'src/engine/core-modules/emailing-domain/campaign-delivery.entity';
import { MessageSuppressionEntity } from 'src/engine/core-modules/emailing-domain/message-suppression.entity';
import { UnsubscribeTopicEntity } from 'src/engine/core-modules/emailing-domain/unsubscribe-topic.entity';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { UsageModule } from 'src/engine/core-modules/usage/usage.module';
import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { MessageChannelMetadataModule } from 'src/engine/metadata-modules/message-channel/message-channel-metadata.module';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';
import { UserRoleModule } from 'src/engine/metadata-modules/user-role/user-role.module';
import { WorkspaceManyOrAllFlatEntityMapsCacheModule } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.module';
import { provideWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/provide-workspace-scoped-repository';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { WorkspaceEventEmitterModule } from 'src/engine/workspace-event-emitter/workspace-event-emitter.module';
import { UsageLimitModule } from 'src/engine/core-modules/usage-limit/usage-limit.module';
import { BackfillCampaignRepliesCommand } from 'src/modules/emailing/commands/backfill-campaign-replies.command';
import { EngagementTrackingController } from 'src/modules/emailing/controllers/engagement-tracking.controller';
import { UnsubscribeController } from 'src/modules/emailing/controllers/unsubscribe.controller';
import { EmailingOngoingStaleCronCommand } from 'src/modules/emailing/crons/commands/emailing-ongoing-stale.cron.command';
import { EmailingOngoingStaleCronJob } from 'src/modules/emailing/crons/jobs/emailing-ongoing-stale.cron.job';
import { ReconcileCampaignStatsCronCommand } from 'src/modules/emailing/crons/commands/reconcile-campaign-stats.cron.command';
import { ReconcileCampaignStatsCronJob } from 'src/modules/emailing/crons/jobs/reconcile-campaign-stats.cron.job';
import { EmailingSendResolver } from 'src/modules/emailing/resolvers/emailing-send.resolver';
import { MessageCampaignResolver } from 'src/modules/emailing/resolvers/message-campaign.resolver';
import { MessageSuppressionResolver } from 'src/modules/emailing/resolvers/message-suppression.resolver';
import { UnsubscribeTopicResolver } from 'src/modules/emailing/resolvers/unsubscribe-topic.resolver';
import { CampaignVariableService } from 'src/modules/emailing/services/campaign-variable.service';
import { ThrottlerModule } from 'src/engine/core-modules/throttler/throttler.module';
import { EmailBillingService } from 'src/modules/emailing/services/email-billing.service';
import { EmailingDomainSenderService } from 'src/modules/emailing/services/emailing-domain-sender.service';
import { MessageCampaignAuthoringService } from 'src/modules/emailing/services/message-campaign-authoring.service';
import { MessageCampaignDraftService } from 'src/modules/emailing/services/message-campaign-draft.service';
import { MessageCampaignRecoveryService } from 'src/modules/emailing/services/message-campaign-recovery.service';
import { MessageCampaignStatisticsService } from 'src/modules/emailing/services/message-campaign-statistics.service';
import { MessageCampaignQueryService } from 'src/modules/emailing/services/message-campaign-query.service';
import { MessageCampaignAudienceService } from 'src/modules/emailing/services/message-campaign-audience.service';
import { MessageCampaignDeliveryFeedbackService } from 'src/modules/emailing/services/message-campaign-delivery-feedback.service';
import { MessageCampaignDeliveryService } from 'src/modules/emailing/services/message-campaign-delivery.service';
import { MessageCampaignLifecycleService } from 'src/modules/emailing/services/message-campaign-lifecycle.service';
import { MessageCampaignMaterializationService } from 'src/modules/emailing/services/message-campaign-materialization.service';
import { MessageCampaignService } from 'src/modules/emailing/services/message-campaign.service';
import { MessageEngagementService } from 'src/modules/emailing/services/message-engagement.service';
import { MessageSuppressionService } from 'src/modules/emailing/services/message-suppression.service';
import { UnsubscribeTopicService } from 'src/modules/emailing/services/unsubscribe-topic.service';
import { SaveCampaignTool } from 'src/modules/emailing/tools/save-campaign-tool';

@Module({
  imports: [
    EmailingDomainModule,
    ThrottlerModule,
    MessageChannelMetadataModule,
    FeatureFlagModule,
    PermissionsModule,
    UserRoleModule,
    BillingModule,
    UsageModule,
    WorkspaceEventEmitterModule,
    WorkspaceCacheModule,
    WorkspaceManyOrAllFlatEntityMapsCacheModule,
    WorkspaceIteratorModule,
    UsageLimitModule,
    TypeOrmModule.forFeature([
      MessageChannelEntity,
      EmailingDomainEntity,
      MessageSuppressionEntity,
      UnsubscribeTopicEntity,
      CampaignDeliveryEntity,
      WorkspaceEntity,
    ]),
  ],
  controllers: [UnsubscribeController, EngagementTrackingController],
  providers: [
    BackfillCampaignRepliesCommand,
    CampaignVariableService,
    EmailBillingService,
    MessageCampaignService,
    MessageCampaignAudienceService,
    MessageCampaignAuthoringService,
    MessageCampaignDeliveryService,
    MessageCampaignDeliveryFeedbackService,
    MessageCampaignLifecycleService,
    MessageCampaignMaterializationService,
    MessageCampaignDraftService,
    MessageCampaignQueryService,
    MessageCampaignRecoveryService,
    MessageCampaignStatisticsService,
    MessageEngagementService,
    MessageSuppressionService,
    UnsubscribeTopicService,
    EmailingDomainSenderService,
    SaveCampaignTool,
    EmailingSendResolver,
    MessageCampaignResolver,
    MessageSuppressionResolver,
    UnsubscribeTopicResolver,
    provideWorkspaceScopedRepository(EmailingDomainEntity),
    provideWorkspaceScopedRepository(MessageSuppressionEntity),
    provideWorkspaceScopedRepository(UnsubscribeTopicEntity),
    provideWorkspaceScopedRepository(CampaignDeliveryEntity),
    EmailingOngoingStaleCronCommand,
    EmailingOngoingStaleCronJob,
    ReconcileCampaignStatsCronCommand,
    ReconcileCampaignStatsCronJob,
  ],
  exports: [
    EmailingDomainSenderService,
    EmailBillingService,
    MessageCampaignAuthoringService,
    MessageCampaignService,
    MessageCampaignDeliveryService,
    MessageCampaignDeliveryFeedbackService,
    MessageCampaignMaterializationService,
    MessageCampaignDraftService,
    MessageCampaignStatisticsService,
    MessageEngagementService,
    MessageSuppressionService,
    UnsubscribeTopicService,
    SaveCampaignTool,
    EmailingOngoingStaleCronCommand,
    ReconcileCampaignStatsCronCommand,
  ],
})
export class EmailingModule {}
