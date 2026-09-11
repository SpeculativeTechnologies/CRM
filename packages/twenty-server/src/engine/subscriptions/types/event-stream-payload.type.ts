import { type EventStreamMetadataEvent } from 'src/engine/subscriptions/types/event-stream-metadata-event.type';
import { type ObjectRecordSubscriptionEvent } from 'src/engine/subscriptions/types/object-record-subscription-event.type';

export type EventStreamPayload = {
  queryIdsToRefetch?: string[];
  objectRecordEventsWithQueryIds: {
    queryIds: string[];
    objectRecordEvent: ObjectRecordSubscriptionEvent;
  }[];
  metadataEvents: EventStreamMetadataEvent[];
};
