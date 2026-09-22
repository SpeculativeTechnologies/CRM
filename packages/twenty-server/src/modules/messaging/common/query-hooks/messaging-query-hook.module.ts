import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { MessageFolderEntity } from 'src/engine/metadata-modules/message-folder/entities/message-folder.entity';
import { ApplyMessagesVisibilityRestrictionsService } from 'src/modules/messaging/common/query-hooks/message/apply-messages-visibility-restrictions.service';
import { MessageDeleteManyPostQueryHook } from 'src/modules/messaging/common/query-hooks/message/message-delete-many.post-query.hook';
import { MessageDeleteOnePostQueryHook } from 'src/modules/messaging/common/query-hooks/message/message-delete-one.post-query.hook';
import { MessageDestroyManyPostQueryHook } from 'src/modules/messaging/common/query-hooks/message/message-destroy-many.post-query.hook';
import { MessageDestroyOnePostQueryHook } from 'src/modules/messaging/common/query-hooks/message/message-destroy-one.post-query.hook';
import { MessageRestoreManyPostQueryHook } from 'src/modules/messaging/common/query-hooks/message/message-restore-many.post-query.hook';
import { MessageRestoreOnePostQueryHook } from 'src/modules/messaging/common/query-hooks/message/message-restore-one.post-query.hook';
import { MessageUpdateManyPostQueryHook } from 'src/modules/messaging/common/query-hooks/message/message-update-many.post-query.hook';
import { MessageUpdateOnePostQueryHook } from 'src/modules/messaging/common/query-hooks/message/message-update-one.post-query.hook';
import { MessageFindManyPostQueryHook } from 'src/modules/messaging/common/query-hooks/message/message-find-many.post-query.hook';
import { MessageFindOnePostQueryHook } from 'src/modules/messaging/common/query-hooks/message/message-find-one.post-query.hook';
import { MessageThreadTargetCreateManyPreQueryHook } from 'src/modules/messaging/common/query-hooks/message-thread-target/message-thread-target-create-many.pre-query-hook';
import { MessageThreadTargetCreateOnePreQueryHook } from 'src/modules/messaging/common/query-hooks/message-thread-target/message-thread-target-create-one.pre-query-hook';
import { MessagingImportManagerModule } from 'src/modules/messaging/message-import-manager/messaging-import-manager.module';

@Module({
  imports: [
    MessagingImportManagerModule,
    TypeOrmModule.forFeature([
      ConnectedAccountEntity,
      MessageChannelEntity,
      MessageFolderEntity,
      UserWorkspaceEntity,
    ]),
  ],
  providers: [
    ApplyMessagesVisibilityRestrictionsService,
    MessageFindOnePostQueryHook,
    MessageFindManyPostQueryHook,
    MessageUpdateOnePostQueryHook,
    MessageUpdateManyPostQueryHook,
    MessageDeleteOnePostQueryHook,
    MessageDeleteManyPostQueryHook,
    MessageDestroyOnePostQueryHook,
    MessageDestroyManyPostQueryHook,
    MessageRestoreOnePostQueryHook,
    MessageRestoreManyPostQueryHook,
    MessageThreadTargetCreateOnePreQueryHook,
    MessageThreadTargetCreateManyPreQueryHook,
  ],
})
export class MessagingQueryHookModule {}
