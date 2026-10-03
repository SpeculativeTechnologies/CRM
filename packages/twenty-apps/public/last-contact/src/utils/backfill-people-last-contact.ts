import { type CoreApiClient } from 'twenty-client-sdk/core';

import {
  buildPersonAggregates,
  buildPersonUpdateData,
} from 'src/utils/person-last-contact-aggregation';
import { type RecordUpsert } from 'src/utils/upsert-records-in-batches';
import { collectPersonLastContactState } from 'src/utils/update-person-last-contact';
import { savePersonContactUpdates } from 'src/utils/save-person-contact-updates';

export const backfillPeopleLastContact = async (
  client: CoreApiClient,
  personIds: string[],
): Promise<void> => {
  const stateByPersonId = await collectPersonLastContactState(
    client,
    personIds,
  );
  const aggByPersonId = await buildPersonAggregates(client, personIds);
  const upserts: RecordUpsert[] = [];

  for (const personId of personIds) {
    const agg = aggByPersonId.get(personId);
    const data = agg ? buildPersonUpdateData(agg) : {};

    if (Object.keys(data).length === 0) {
      continue;
    }

    upserts.push({ id: personId, ...data });
  }

  await savePersonContactUpdates(client, upserts, stateByPersonId);
};
