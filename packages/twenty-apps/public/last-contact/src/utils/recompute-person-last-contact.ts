import { type CoreApiClient } from 'twenty-client-sdk/core';

import {
  buildPersonAggregates,
  buildPersonUpdateData,
  type PersonUpdateData,
} from 'src/utils/person-last-contact-aggregation';
import {
  PERSON_CONTACT_SELECTION,
  buildPersonContactSnapshotFilter,
} from 'src/utils/person-contact-snapshot';
import { recomputeCompanyLastContact } from 'src/utils/recompute-company-last-contact';

const EMPTY_PERSON_CONTACT: PersonUpdateData = {
  lastContactAt: null,
  lastContactById: null,
  lastOutboundAt: null,
  lastInboundAt: null,
  lastEmailId: null,
  lastMeetingId: null,
  lastContactItemMessageId: null,
  lastContactItemCalendarEventId: null,
  lastContactItemContactLogId: null,
};

// A correction can move recency backwards, so recompute from the surviving source
// records. Compare the contact snapshot to avoid overwriting an interaction saved mid-query.
export const recomputePersonLastContact = async (
  client: CoreApiClient,
  personId: string,
): Promise<void> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { person } = await client.query({
      person: {
        __args: { filter: { id: { eq: personId } } },
        id: true,
        ...PERSON_CONTACT_SELECTION,
        companyId: true,
      },
    });
    if (!person) {
      return;
    }

    const aggregates = await buildPersonAggregates(client, [personId]);
    const data = {
      ...EMPTY_PERSON_CONTACT,
      ...buildPersonUpdateData(aggregates.get(personId) ?? {}),
    };
    const { updatePeople } = await client.mutation({
      updatePeople: {
        __args: {
          data,
          filter: {
            and: [
              { id: { eq: personId } },
              ...buildPersonContactSnapshotFilter(person),
            ],
          },
        },
        id: true,
      },
    });
    if (!Array.isArray(updatePeople) || updatePeople.length === 0) {
      continue;
    }

    // Read the saved person again so a concurrently changed company is included.
    const { person: savedPerson } = await client.query({
      person: {
        __args: { filter: { id: { eq: personId } } },
        id: true,
        companyId: true,
        lastContactAt: true,
        lastContactItemMessageId: true,
        lastContactItemCalendarEventId: true,
        lastContactItemContactLogId: true,
      },
    });
    if (!savedPerson) {
      return;
    }
    await client.mutation({
      updateOpportunities: {
        __args: {
          filter: { pointOfContactId: { eq: personId } },
          data: {
            lastContactAt: savedPerson.lastContactAt ?? null,
            lastContactItemMessageId:
              savedPerson.lastContactItemMessageId ?? null,
            lastContactItemCalendarEventId:
              savedPerson.lastContactItemCalendarEventId ?? null,
            lastContactItemContactLogId:
              savedPerson.lastContactItemContactLogId ?? null,
          },
        },
        id: true,
      },
    });
    const companyIds = new Set<string>(
      [person.companyId, savedPerson.companyId].filter((id): id is string =>
        Boolean(id),
      ),
    );
    for (const companyId of companyIds) {
      await recomputeCompanyLastContact(client, companyId);
    }
    return;
  }
  throw new Error(
    'Person changed while recomputing last contact; retry this event.',
  );
};
