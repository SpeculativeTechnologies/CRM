import { type EmailRecipientPerson } from '@/activities/emails/recipients/types/EmailRecipientPerson';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { getPreferredFirstName } from 'twenty-shared/utils';

export const getEmailRecipientPersonFromRecord = (
  personRecord: ObjectRecord,
): EmailRecipientPerson => ({
  id: personRecord.id,
  firstName: getPreferredFirstName(
    personRecord.name?.firstName,
    personRecord.preferredName,
  ),
  lastName: personRecord.name?.lastName ?? '',
  avatarUrl: personRecord.avatarUrl ?? null,
  primaryEmail: personRecord.emails?.primaryEmail ?? '',
});
