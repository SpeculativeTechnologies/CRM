import { act, renderHook, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';

import { useRecoverAuthProxySession } from '@/apollo/hooks/useRecoverAuthProxySession';
import { isAuthProxySessionExpiredState } from '@/apollo/states/isAuthProxySessionExpiredState';
import { isAuthProxyRedirect } from '@/apollo/utils/isAuthProxyRedirect';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

jest.mock('@/apollo/utils/isAuthProxyRedirect', () => ({
  isAuthProxyRedirect: jest.fn(),
}));

const mockRefetchQueries = jest.fn();

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useApolloClient: () => ({ refetchQueries: mockRefetchQueries }),
}));

const mockIsAuthProxyRedirect = isAuthProxyRedirect as jest.MockedFunction<
  typeof isAuthProxyRedirect
>;

const useTestHarness = () => {
  const [isAuthProxySessionExpired, setIsAuthProxySessionExpired] = useAtomState(
    isAuthProxySessionExpiredState,
  );

  useRecoverAuthProxySession();

  return { isAuthProxySessionExpired, setIsAuthProxySessionExpired };
};

const renderExpiredSession = async () => {
  const rendered = renderHook(() => useTestHarness());

  await act(async () => {
    rendered.result.current.setIsAuthProxySessionExpired(true);
  });

  return rendered;
};

describe('useRecoverAuthProxySession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefetchQueries.mockResolvedValue([]);
    getDefaultStore().set(isAuthProxySessionExpiredState.atom, false);
  });

  it('should clear the expired session and refetch when the proxy stops redirecting', async () => {
    mockIsAuthProxyRedirect.mockResolvedValue(false);

    const { result } = await renderExpiredSession();

    expect(result.current.isAuthProxySessionExpired).toBe(true);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(result.current.isAuthProxySessionExpired).toBe(false);
    });

    expect(mockRefetchQueries).toHaveBeenCalledWith({ include: 'active' });
  });

  it('should keep the banner up while the proxy is still redirecting', async () => {
    mockIsAuthProxyRedirect.mockResolvedValue(true);

    const { result } = await renderExpiredSession();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(mockIsAuthProxyRedirect).toHaveBeenCalled();
    });

    expect(result.current.isAuthProxySessionExpired).toBe(true);
    expect(mockRefetchQueries).not.toHaveBeenCalled();
  });

  it('should not probe while the session is healthy', async () => {
    mockIsAuthProxyRedirect.mockResolvedValue(false);

    renderHook(() => useTestHarness());

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(mockIsAuthProxyRedirect).not.toHaveBeenCalled();
  });

  it('should clear the expired session even when the refetch fails, since the proxy already let the probe through', async () => {
    mockIsAuthProxyRedirect.mockResolvedValue(false);
    mockRefetchQueries.mockRejectedValue(new Error('network down'));

    const { result } = await renderExpiredSession();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(mockRefetchQueries).toHaveBeenCalled();
    });

    expect(result.current.isAuthProxySessionExpired).toBe(false);
  });
});
