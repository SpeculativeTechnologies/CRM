import { type WorkspacePostQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';

import { isApiKeyAuthContext } from 'src/engine/core-modules/auth/guards/is-api-key-auth-context.guard';
import { isApplicationAuthContext } from 'src/engine/core-modules/auth/guards/is-application-auth-context.guard';
import { isUserAuthContext } from 'src/engine/core-modules/auth/guards/is-user-auth-context.guard';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { ForbiddenError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { ApplyCalendarEventsVisibilityRestrictionsService } from 'src/modules/calendar/common/query-hooks/calendar-event/services/apply-calendar-events-visibility-restrictions.service';
import { type CalendarEventWorkspaceEntity } from 'src/modules/calendar/common/standard-objects/calendar-event.workspace-entity';

// Every operation that returns calendar event records has to redact them, not
// just the read ones: a mutation echoes the record back, so an empty
// updateCalendarEvent was enough to read a title and description that the
// equivalent query redacts.
export abstract class CalendarEventVisibilityPostQueryHook implements WorkspacePostQueryHookInstance {
  constructor(
    protected readonly applyCalendarEventsVisibilityRestrictionsService: ApplyCalendarEventsVisibilityRestrictionsService,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: CalendarEventWorkspaceEntity[],
  ): Promise<void> {
    const isUserContext = isUserAuthContext(authContext);
    const userId = isUserContext ? authContext.user.id : undefined;

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

    await this.applyCalendarEventsVisibilityRestrictionsService.applyCalendarEventsVisibilityRestrictions(
      payload,
      workspace.id,
      userId,
    );
  }
}
