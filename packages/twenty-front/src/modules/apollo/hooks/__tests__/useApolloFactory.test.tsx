import { gql } from '@apollo/client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import fetchMock, { enableFetchMocks } from 'jest-fetch-mock';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SnackBarComponentInstanceContext } from '@/ui/feedback/snack-bar-manager/contexts/SnackBarComponentInstanceContext';
import { useApolloFactory } from '@/apollo/hooks/useApolloFactory';
import { isAuthProxySessionExpiredState } from '@/apollo/states/isAuthProxySessionExpiredState';
import { isAuthProxyRedirect } from '@/apollo/utils/isAuthProxyRedirect';
import {
  type CurrentUser,
  currentUserState,
} from '@/auth/states/currentUserState';
import { reloadWindow } from '~/utils/reloadWindow';

enableFetchMocks();

jest.mock('@/apollo/utils/isAuthProxyRedirect', () => ({
  isAuthProxyRedirect: jest.fn(),
}));

jest.mock('~/utils/reloadWindow', () => ({
  reloadWindow: jest.fn(),
}));

const mockIsAuthProxyRedirect = isAuthProxyRedirect as jest.MockedFunction<
  typeof isAuthProxyRedirect
>;

jest.mock('@/apollo/utils/getTokenPair', () => ({
  getTokenPair: jest.fn().mockReturnValue({
    accessOrWorkspaceAgnosticToken: { token: 'testAccessToken', expiresAt: '' },
    refreshToken: { token: 'testRefreshToken', expiresAt: '' },
  }),
}));

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const initialRouter = jest.requireActual('react-router-dom');

  return {
    ...initialRouter,
    useNavigate: () => mockNavigate,
  };
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter
    initialEntries={['/welcome', '/verify', '/opportunities']}
    initialIndex={2}
  >
    <SnackBarComponentInstanceContext.Provider
      value={{ instanceId: 'test-instance-id' }}
    >
      {children}
    </SnackBarComponentInstanceContext.Provider>
  </MemoryRouter>
);

describe('useApolloFactory', () => {
  it('should work as expected', () => {
    const { result } = renderHook(() => useApolloFactory(), {
      wrapper: Wrapper,
    });

    const res = result.current;

    expect(res).toBeDefined();
    expect(res).toHaveProperty('link');
    expect(res).toHaveProperty('cache');
    expect(res).toHaveProperty('query');
  });

  it('should navigate to /welcome on unauthenticated error', async () => {
    const errors = [
      {
        extensions: {
          code: 'UNAUTHENTICATED',
        },
      },
    ];
    fetchMock.mockResponse(() =>
      Promise.resolve({
        body: JSON.stringify({
          data: {},
          errors,
        }),
      }),
    );

    const { result } = renderHook(
      () => {
        const location = useLocation();
        return { factory: useApolloFactory(), location };
      },
      {
        wrapper: Wrapper,
      },
    );

    expect(result.current.location.pathname).toBe('/opportunities');

    try {
      await act(async () => {
        await result.current.factory.mutate({
          mutation: gql`
            mutation Track($type: String!, $sessionId: String!, $data: JSON!) {
              track(type: $type, sessionId: $sessionId, data: $data) {
                success
              }
            }
          `,
        });
      });
    } catch (error) {
      expect(error).toBeDefined();

      expect(mockNavigate).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/welcome');
    }
  });

  describe('when the auth proxy session has expired', () => {
    const store = getDefaultStore();

    const triggerOpaqueNetworkFailure = async (
      factory: ReturnType<typeof useApolloFactory>,
    ) => {
      fetchMock.mockReject(new TypeError('Failed to fetch'));

      await act(async () => {
        await factory
          .query({
            query: gql`
              query FindCurrentUser {
                currentUser {
                  id
                }
              }
            `,
            fetchPolicy: 'network-only',
          })
          .catch(() => undefined);
      });
    };

    beforeEach(() => {
      jest.clearAllMocks();
      sessionStorage.clear();
      mockIsAuthProxyRedirect.mockResolvedValue(true);
      store.set(isAuthProxySessionExpiredState.atom, false);
      store.set(currentUserState.atom, null);
    });

    it('should reload on a cold load, when there is no signed-in user with state to lose', async () => {
      const { result } = renderHook(() => useApolloFactory(), {
        wrapper: Wrapper,
      });

      await triggerOpaqueNetworkFailure(result.current);

      await waitFor(() => {
        expect(reloadWindow).toHaveBeenCalledTimes(1);
      });

      expect(store.get(isAuthProxySessionExpiredState.atom)).toBe(false);
    });

    it('should raise the banner instead of reloading once a user is signed in and working', async () => {
      // Only its presence matters here: it is what tells the factory a user is
      // signed in and has state a reload would discard.
      store.set(currentUserState.atom, {
        id: 'test-user-id',
      } as CurrentUser);

      const { result } = renderHook(() => useApolloFactory(), {
        wrapper: Wrapper,
      });

      await triggerOpaqueNetworkFailure(result.current);

      await waitFor(() => {
        expect(store.get(isAuthProxySessionExpiredState.atom)).toBe(true);
      });

      expect(reloadWindow).not.toHaveBeenCalled();
    });
  });
});
