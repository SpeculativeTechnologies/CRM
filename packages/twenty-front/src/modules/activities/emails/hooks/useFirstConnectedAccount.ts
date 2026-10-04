import { EmailOperation } from 'twenty-shared/types';
import { useQuery } from '@apollo/client/react';

import { type ConnectedAccount } from '@/accounts/types/ConnectedAccount';
import { GET_MY_CONNECTED_ACCOUNTS } from '@/settings/accounts/graphql/queries/getMyConnectedAccounts';
import { canConnectedAccountPerformEmailOperation } from 'twenty-shared/utils';

type UseFirstConnectedAccountOptions = {
  skip?: boolean;
  preferredHandle?: string;
};

export const useFirstConnectedAccount = (
  options?: UseFirstConnectedAccountOptions,
) => {
  const { data, loading } = useQuery<{
    myConnectedAccounts: Pick<
      ConnectedAccount,
      'id' | 'handle' | 'provider' | 'connectionParameters'
    >[];
  }>(GET_MY_CONNECTED_ACCOUNTS, {
    skip: options?.skip,
  });

  const sendableAccounts =
    data?.myConnectedAccounts?.filter((connectedAccount) =>
      canConnectedAccountPerformEmailOperation({
        connectedAccount,
        operation: EmailOperation.SEND,
      }),
    ) ?? [];

  const connectedAccount = options?.preferredHandle
    ? (sendableAccounts.find(
        ({ handle }) =>
          handle.toLowerCase() === options.preferredHandle?.toLowerCase(),
      ) ?? null)
    : (sendableAccounts[0] ?? null);

  return {
    connectedAccountId: connectedAccount?.id ?? null,
    connectedAccountHandle: connectedAccount?.handle ?? null,
    loading,
  };
};
