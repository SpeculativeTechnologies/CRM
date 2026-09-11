import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
  gql,
} from '@apollo/client';
import { renderHook } from '@testing-library/react';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useLazyFindManyRecordsWithOffset } from '@/object-record/hooks/useLazyFindManyRecordsWithOffset';
import { useFindManyRecordsQuery } from '@/object-record/hooks/useFindManyRecordsQuery';

jest.mock('@/object-metadata/hooks/useApolloCoreClient');
jest.mock('@/object-record/hooks/useFindManyRecordsQuery');
jest.mock('@/object-metadata/hooks/useObjectMetadataItem', () => ({
  useObjectMetadataItem: () => ({
    objectMetadataItem: { id: 'recruitment', namePlural: 'recruitments' },
  }),
}));
jest.mock(
  '@/object-record/record-index/hooks/useFindManyRecordIndexTableParams',
  () => ({
    useFindManyRecordIndexTableParams: () => ({
      orderBy: [{ linkedRecommendations: { name: 'DescNullsLast' } }],
    }),
  }),
);
jest.mock(
  '@/object-record/record-field/hooks/useRelevantRecordsGqlFields',
  () => ({
    useRelevantRecordsGqlFields: () => ({ id: true }),
  }),
);
jest.mock('@/object-record/hooks/useObjectPermissionsForObject', () => ({
  useObjectPermissionsForObject: () => ({ canReadObjectRecords: true }),
}));
jest.mock('@/object-record/hooks/useHandleFindManyRecordsError', () => ({
  useHandleFindManyRecordsError: () => ({
    handleFindManyRecordsError: jest.fn(),
  }),
}));

const query = gql`
  query Recruitments(
    $limit: Int!
    $offset: Int!
    $orderBy: [RecruitmentOrderByInput!]
  ) {
    recruitments(limit: $limit, offset: $offset, orderBy: $orderBy) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

describe('useLazyFindManyRecordsWithOffset', () => {
  it.each([0, 100])(
    'should reload current membership and order for a previously cached page at offset %i',
    async (offset) => {
      let serverIds = ['root', 'zulu', 'alpha'];
      let requests = 0;
      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new ApolloLink(
          () =>
            new Observable((observer) => {
              requests++;
              observer.next({
                data: {
                  recruitments: {
                    edges: serverIds.map((id) => ({
                      node: { __typename: 'Recruitment', id, name: id },
                    })),
                  },
                },
              });
              observer.complete();
            }),
        ),
      });
      jest.mocked(useApolloCoreClient).mockReturnValue(client);
      jest
        .mocked(useFindManyRecordsQuery)
        .mockReturnValue({ findManyRecordsQuery: query });
      const { result, unmount } = renderHook(() =>
        useLazyFindManyRecordsWithOffset({ objectNameSingular: 'recruitment' }),
      );

      const readPage = async () =>
        (
          await result.current.findManyRecordsLazyWithOffset(100, offset)
        ).records?.map(({ id }) => id);
      expect(await readPage()).toEqual(['root', 'zulu', 'alpha']);
      // A related-record change updates the sort key without changing page variables or count.
      serverIds = ['alpha', 'root', 'zulu'];
      expect(await readPage()).toEqual(['alpha', 'root', 'zulu']);
      // A filtered page can also change membership while retaining the same count.
      serverIds = ['alpha', 'replacement', 'zulu'];
      expect(await readPage()).toEqual(['alpha', 'replacement', 'zulu']);
      expect(requests).toBe(3);

      unmount();
      client.stop();
    },
  );
});
