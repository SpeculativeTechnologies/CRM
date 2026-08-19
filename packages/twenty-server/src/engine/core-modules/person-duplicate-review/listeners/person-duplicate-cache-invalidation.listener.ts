import { Injectable } from '@nestjs/common';

import {
  type ObjectRecordCreateEvent,
  type ObjectRecordDeleteEvent,
  type ObjectRecordDestroyEvent,
  type ObjectRecordRestoreEvent,
  type ObjectRecordUpdateEvent,
} from 'twenty-shared/database-events';

import { OnDatabaseBatchEvent } from 'src/engine/api/graphql/graphql-query-runner/decorators/on-database-batch-event.decorator';
import { DatabaseEventAction } from 'src/engine/api/graphql/graphql-query-runner/enums/database-event-action';
import { PersonDuplicateReviewService } from 'src/engine/core-modules/person-duplicate-review/person-duplicate-review.service';
import { type WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

type PersonEvent =
  | ObjectRecordCreateEvent<PersonWorkspaceEntity>
  | ObjectRecordUpdateEvent<PersonWorkspaceEntity>
  | ObjectRecordDeleteEvent<PersonWorkspaceEntity>
  | ObjectRecordDestroyEvent<PersonWorkspaceEntity>
  | ObjectRecordRestoreEvent<PersonWorkspaceEntity>;

// Any person change can create or dissolve a duplicate group, so the cached
// computation is dropped wholesale; the next read recomputes it.
@Injectable()
export class PersonDuplicateCacheInvalidationListener {
  constructor(
    private readonly personDuplicateReviewService: PersonDuplicateReviewService,
  ) {}

  @OnDatabaseBatchEvent('person', DatabaseEventAction.CREATED)
  @OnDatabaseBatchEvent('person', DatabaseEventAction.UPDATED)
  @OnDatabaseBatchEvent('person', DatabaseEventAction.DELETED)
  @OnDatabaseBatchEvent('person', DatabaseEventAction.DESTROYED)
  @OnDatabaseBatchEvent('person', DatabaseEventAction.RESTORED)
  async handlePersonEvent(
    payload: WorkspaceEventBatch<PersonEvent>,
  ): Promise<void> {
    await this.personDuplicateReviewService.invalidateDuplicateGroupsCache(
      payload.workspaceId,
    );
  }
}
