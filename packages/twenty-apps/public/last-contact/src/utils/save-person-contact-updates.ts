import { type CoreApiClient } from 'twenty-client-sdk/core';

import { executeWithRetry } from 'src/utils/execute-with-retry';
import {
  buildPersonContactSnapshotFilter,
  type PersonContactSnapshot,
} from 'src/utils/person-contact-snapshot';
import { recomputePersonLastContact } from 'src/utils/recompute-person-last-contact';
import { type RecordUpsert } from 'src/utils/upsert-records-in-batches';

// Batched reads can race manual contact corrections or other imports. Keep the
// snapshot check in the mutation so a stale batch cannot overwrite newer recency
// or recreate a person deleted after collection.
export const savePersonContactUpdates = async (
  client: CoreApiClient,
  updates: RecordUpsert[],
  snapshots: Map<string, PersonContactSnapshot>,
): Promise<void> => {
  for (const { id, ...data } of updates) {
    const snapshot = snapshots.get(id);

    if (!snapshot) {
      continue;
    }

    const { updatePeople } = await executeWithRetry(() =>
      client.mutation({
        updatePeople: {
          __args: {
            data,
            filter: {
              and: [
                { id: { eq: id } },
                ...buildPersonContactSnapshotFilter(snapshot),
              ],
            },
          },
          id: true,
        },
      }),
    );

    if (!Array.isArray(updatePeople) || updatePeople.length === 0) {
      await recomputePersonLastContact(client, id);
    }
  }
};
