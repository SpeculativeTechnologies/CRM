import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { type BackfillBatchPayload } from 'src/constants/backfill';
import { BACKFILL_PEOPLE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { buildBackfillBatchArgs } from 'src/utils/backfill-batch-args';
import { getBackfillBatchSize } from 'src/utils/backfill-settings';
import {
  PERSON_CONTACT_SELECTION,
  buildPersonContactSnapshotFilter,
  type PersonContactSnapshot,
} from 'src/utils/person-contact-snapshot';
import { recomputePersonLastContact } from 'src/utils/recompute-person-last-contact';
import { executeWithRetry } from 'src/utils/execute-with-retry';
import {
  buildPersonAggregates,
  buildPersonUpdateData,
} from 'src/utils/person-last-contact-aggregation';

const handler = async ({ batchId }: BackfillBatchPayload): Promise<object> => {
  const client = new CoreApiClient();

  const { people } = await executeWithRetry(() =>
    client.query({
      people: {
        __args: buildBackfillBatchArgs(batchId, getBackfillBatchSize()),
        edges: { node: { id: true, ...PERSON_CONTACT_SELECTION } },
      },
    }),
  );

  const snapshots: ({ id: string } & PersonContactSnapshot)[] = (
    people?.edges ?? []
  ).map((edge: { node: { id: string } & PersonContactSnapshot }) => edge.node);
  const personIds = snapshots.map((person) => person.id).filter(Boolean);

  if (personIds.length === 0) {
    return { batchId, count: 0 };
  }

  const aggByPersonId = await buildPersonAggregates(client, personIds);

  for (const person of snapshots) {
    const personId = person.id;
    const agg = aggByPersonId.get(personId);
    const data = agg ? buildPersonUpdateData(agg) : {};

    if (Object.keys(data).length === 0) {
      continue;
    }

    const { updatePeople } = await executeWithRetry(() =>
      client.mutation({
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
      }),
    );
    if (!Array.isArray(updatePeople) || updatePeople.length === 0) {
      await recomputePersonLastContact(client, personId);
    }
  }

  return { batchId, count: personIds.length };
};

export default defineLogicFunction({
  universalIdentifier: BACKFILL_PEOPLE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'backfill-people-last-contact',
  description:
    'Backfills last-contact fields for one batch of people, resolved from the batch id in its payload.',
  timeoutSeconds: 120,
  handler,
});
