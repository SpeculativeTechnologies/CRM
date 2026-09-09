import { act, renderHook } from '@testing-library/react';

import {
  query,
  responseData,
  variables,
} from '@/object-record/hooks/__mocks__/useUpdateOneRecord';
import { useRefetchAggregateQueries } from '@/object-record/hooks/useRefetchAggregateQueries';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { tryCommitLocalFirstRecordUpdate } from '@/local-first/services/tryCommitLocalFirstRecordUpdate';
import { getJestMetadataAndApolloMocksWrapper } from '~/testing/jest/getJestMetadataAndApolloMocksWrapper';

const person = { id: '36abbb63-34ed-4a16-89f5-f549ac55d0f9' };
jest.mock('@/local-first/services/tryCommitLocalFirstRecordUpdate', () => ({
  tryCommitLocalFirstRecordUpdate: jest.fn().mockResolvedValue(false),
}));
const updateInput = {
  name: {
    firstName: 'John',
    lastName: 'Doe',
  },
};
const updatePerson = {
  ...person,
  ...responseData,
  ...updateInput,
};

const mocks = [
  {
    request: {
      query,
      variables,
    },
    result: jest.fn(() => ({
      data: {
        updatePerson,
      },
    })),
  },
];

jest.mock('@/object-record/hooks/useRefetchAggregateQueries');
const mockRefetchAggregateQueries = jest.fn();
(useRefetchAggregateQueries as jest.Mock).mockReturnValue({
  refetchAggregateQueries: mockRefetchAggregateQueries,
});

const Wrapper = getJestMetadataAndApolloMocksWrapper({
  apolloMocks: mocks,
});

const idToUpdate = '36abbb63-34ed-4a16-89f5-f549ac55d0f9';

describe('useUpdateOneRecord', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('should report a failed local commit without sending an online mutation', async () => {
    jest
      .mocked(tryCommitLocalFirstRecordUpdate)
      .mockRejectedValueOnce(new Error('Storage full'));
    const reportFailure = jest.fn();
    window.addEventListener('twenty-local-save-failed', reportFailure);
    try {
      const { result } = renderHook(() => useUpdateOneRecord(), {
        wrapper: Wrapper,
      });
      await act(async () => {
        await expect(
          result.current.updateOneRecord({
            objectNameSingular: 'person',
            idToUpdate,
            updateOneRecordInput: updateInput,
          }),
        ).rejects.toThrow('Storage full');
      });
      expect(reportFailure).toHaveBeenCalledTimes(1);
      expect(mocks[0].result).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('twenty-local-save-failed', reportFailure);
    }
  });
  it('works as expected', async () => {
    const { result } = renderHook(() => useUpdateOneRecord(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      const res = await result.current.updateOneRecord({
        objectNameSingular: 'person',
        idToUpdate,
        updateOneRecordInput: updateInput,
      });
      expect(res).toBeDefined();
      expect(res).toHaveProperty('id', person.id);
      expect(res).toHaveProperty('name', updateInput.name);
    });

    expect(mocks[0].result).toHaveBeenCalled();
    expect(mockRefetchAggregateQueries).toHaveBeenCalledTimes(1);
  });
});
