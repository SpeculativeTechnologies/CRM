import { type WorkspacePostQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';

import { isApiKeyAuthContext } from 'src/engine/core-modules/auth/guards/is-api-key-auth-context.guard';
import { isApplicationAuthContext } from 'src/engine/core-modules/auth/guards/is-application-auth-context.guard';
import { isUserAuthContext } from 'src/engine/core-modules/auth/guards/is-user-auth-context.guard';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { ForbiddenError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { ApplyMessagesVisibilityRestrictionsService } from 'src/modules/messaging/common/query-hooks/message/apply-messages-visibility-restrictions.service';
import { type MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';

// Every operation that returns message records has to redact them, not just the
// read ones: a mutation echoes the record back, so an empty updateMessage was
// enough to read a body the equivalent query redacts.
export abstract class MessageVisibilityPostQueryHook implements WorkspacePostQueryHookInstance {
  constructor(
    protected readonly applyMessagesVisibilityRestrictionsService: ApplyMessagesVisibilityRestrictionsService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: MessageWorkspaceEntity[],
  ): Promise<void> {
    // TODO: this check should be removed
    if (
      !isUserAuthContext(authContext) &&
      !isApiKeyAuthContext(authContext) &&
      !isApplicationAuthContext(authContext)
    ) {
      throw new ForbiddenError(
        'Authentication error, auth context should be user, apiKey or application',
      );
    }

    const workspace = authContext.workspace;

    if (!workspace) {
      throw new ForbiddenError('Workspace is required');
    }

    const userId = isUserAuthContext(authContext)
      ? authContext.user.id
      : undefined;

    // An application reading its own channel has no user behind it, so without
    // its applicationId the restrictions would redact the app's own messages.
    const applicationId = isApplicationAuthContext(authContext)
      ? authContext.application.id
      : undefined;

    await this.applyMessagesVisibilityRestrictionsService.applyMessagesVisibilityRestrictions(
      payload,
      workspace.id,
      userId,
      applicationId,
    );
  }
}
