import { Injectable } from '@nestjs/common';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { WorkspaceQueryHookType } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/types/workspace-query-hook.type';
import { CalendarEventVisibilityPostQueryHook } from 'src/modules/calendar/common/query-hooks/calendar-event/calendar-event-visibility.post-query.hook';
import { ApplyCalendarEventsVisibilityRestrictionsService } from 'src/modules/calendar/common/query-hooks/calendar-event/services/apply-calendar-events-visibility-restrictions.service';

@Injectable()
@WorkspaceQueryHook({
  key: `calendarEvent.restoreMany`,
  type: WorkspaceQueryHookType.POST_HOOK,
})
export class CalendarEventRestoreManyPostQueryHook extends CalendarEventVisibilityPostQueryHook {
  // Nest emits no design:paramtypes for a subclass without its own
  // constructor, so the injected service would arrive undefined.
  constructor(
    applyCalendarEventsVisibilityRestrictionsService: ApplyCalendarEventsVisibilityRestrictionsService,
  ) {
    super(applyCalendarEventsVisibilityRestrictionsService);
  }
}
