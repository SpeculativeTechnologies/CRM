import { CoreApiClient } from 'twenty-client-sdk/core';
import {
  defineLogicFunction,
  type DatabaseEventPayload,
  type ObjectRecordBaseEvent,
} from 'twenty-sdk/define';

import { CONTACT_LOG_CHANGED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { recomputePersonLastContact } from 'src/utils/recompute-person-last-contact';

type ContactLogEventRecord = { personId?: string | null };

export const onContactLogChanged = async (
  event: DatabaseEventPayload<ObjectRecordBaseEvent<ContactLogEventRecord>>,
): Promise<void> => {
  if (
    event.name === 'contactLog.updated' &&
    event.properties.updatedFields &&
    !event.properties.updatedFields.some((field) =>
      [
        'personId',
        'occurredAt',
        'direction',
        'createdBy',
        'deletedAt',
      ].includes(field),
    )
  ) {
    return;
  }
  const personIds = new Set([
    event.properties.before?.personId,
    event.properties.after?.personId,
  ]);
  const client = new CoreApiClient();

  // Reassignment must repair both the old person's date and the new person's.
  // Fetch current records instead of trusting event order or stale payload dates.
  for (const personId of personIds) {
    if (personId) {
      await recomputePersonLastContact(client, personId);
    }
  }
};

export default defineLogicFunction({
  universalIdentifier: CONTACT_LOG_CHANGED_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'on-contact-log-changed',
  description:
    'Recomputes last contact when a manual contact is created, edited, deleted, restored, or reassigned.',
  timeoutSeconds: 120,
  databaseEventTriggerSettings: { eventName: 'contactLog.*' },
  handler: onContactLogChanged,
});
