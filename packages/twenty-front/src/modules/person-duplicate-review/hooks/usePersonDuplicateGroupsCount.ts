import { useQuery } from '@apollo/client/react';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { GET_PERSON_DUPLICATE_GROUPS_COUNT } from '@/person-duplicate-review/graphql/personDuplicateReview';
import { type PersonDuplicateGroupsCountData } from '@/person-duplicate-review/types/PersonDuplicateReview';

// Count-only query for the nav badge: the full group tree used to be fetched
// on every boot just to render this number.
export const usePersonDuplicateGroupsCount = () => {
  const apolloCoreClient = useApolloCoreClient();
  const queryResult = useQuery<PersonDuplicateGroupsCountData>(
    GET_PERSON_DUPLICATE_GROUPS_COUNT,
    {
      client: apolloCoreClient,
      fetchPolicy: 'cache-and-network',
    },
  );

  return {
    ...queryResult,
    totalCount: queryResult.data?.personDuplicateGroupsTotalCount ?? 0,
  };
};
