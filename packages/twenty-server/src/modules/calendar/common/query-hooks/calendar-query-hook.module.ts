import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { CalendarChannelEntity } from 'src/engine/metadata-modules/calendar-channel/entities/calendar-channel.entity';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { CalendarEventUpdateOnePostQueryHook } from 'src/modules/calendar/common/query-hooks/calendar-event/calendar-event-update-one.post-query.hook';
import { CalendarEventUpdateManyPostQueryHook } from 'src/modules/calendar/common/query-hooks/calendar-event/calendar-event-update-many.post-query.hook';
import { CalendarEventDeleteOnePostQueryHook } from 'src/modules/calendar/common/query-hooks/calendar-event/calendar-event-delete-one.post-query.hook';
import { CalendarEventDeleteManyPostQueryHook } from 'src/modules/calendar/common/query-hooks/calendar-event/calendar-event-delete-many.post-query.hook';
import { CalendarEventDestroyOnePostQueryHook } from 'src/modules/calendar/common/query-hooks/calendar-event/calendar-event-destroy-one.post-query.hook';
import { CalendarEventDestroyManyPostQueryHook } from 'src/modules/calendar/common/query-hooks/calendar-event/calendar-event-destroy-many.post-query.hook';
import { CalendarEventRestoreOnePostQueryHook } from 'src/modules/calendar/common/query-hooks/calendar-event/calendar-event-restore-one.post-query.hook';
import { CalendarEventRestoreManyPostQueryHook } from 'src/modules/calendar/common/query-hooks/calendar-event/calendar-event-restore-many.post-query.hook';
import { CalendarEventFindManyPostQueryHook } from 'src/modules/calendar/common/query-hooks/calendar-event/calendar-event-find-many.post-query.hook';
import { CalendarEventFindOnePostQueryHook } from 'src/modules/calendar/common/query-hooks/calendar-event/calendar-event-find-one.post-query.hook';
import { ApplyCalendarEventsVisibilityRestrictionsService } from 'src/modules/calendar/common/query-hooks/calendar-event/services/apply-calendar-events-visibility-restrictions.service';
import { CalendarEventTargetCreateManyPreQueryHook } from 'src/modules/calendar/common/query-hooks/calendar-event-target/calendar-event-target-create-many.pre-query-hook';
import { CalendarEventTargetCreateOnePreQueryHook } from 'src/modules/calendar/common/query-hooks/calendar-event-target/calendar-event-target-create-one.pre-query-hook';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CalendarChannelEntity,
      ConnectedAccountEntity,
      UserWorkspaceEntity,
    ]),
  ],
  providers: [
    ApplyCalendarEventsVisibilityRestrictionsService,
    CalendarEventFindOnePostQueryHook,
    CalendarEventFindManyPostQueryHook,
    CalendarEventUpdateOnePostQueryHook,
    CalendarEventUpdateManyPostQueryHook,
    CalendarEventDeleteOnePostQueryHook,
    CalendarEventDeleteManyPostQueryHook,
    CalendarEventDestroyOnePostQueryHook,
    CalendarEventDestroyManyPostQueryHook,
    CalendarEventRestoreOnePostQueryHook,
    CalendarEventRestoreManyPostQueryHook,
    CalendarEventTargetCreateOnePreQueryHook,
    CalendarEventTargetCreateManyPreQueryHook,
  ],
})
export class CalendarQueryHookModule {}
