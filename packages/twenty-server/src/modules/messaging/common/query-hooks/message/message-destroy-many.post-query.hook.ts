import { Injectable } from '@nestjs/common';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { WorkspaceQueryHookType } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/types/workspace-query-hook.type';
import { ApplyMessagesVisibilityRestrictionsService } from 'src/modules/messaging/common/query-hooks/message/apply-messages-visibility-restrictions.service';
import { MessageVisibilityPostQueryHook } from 'src/modules/messaging/common/query-hooks/message/message-visibility.post-query.hook';

@Injectable()
@WorkspaceQueryHook({
  key: `message.destroyMany`,
  type: WorkspaceQueryHookType.POST_HOOK,
})
export class MessageDestroyManyPostQueryHook extends MessageVisibilityPostQueryHook {
  // Nest emits no design:paramtypes for a subclass without its own
  // constructor, so the injected service would arrive undefined.
  constructor(
    applyMessagesVisibilityRestrictionsService: ApplyMessagesVisibilityRestrictionsService,
  ) {
    super(applyMessagesVisibilityRestrictionsService);
  }
}
