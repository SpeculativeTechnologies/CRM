import { useApolloClient } from '@apollo/client/react';
import { useEffect, useRef } from 'react';

import { isAuthProxySessionExpiredState } from '@/apollo/states/isAuthProxySessionExpiredState';
import { isAuthProxyRedirect } from '@/apollo/utils/isAuthProxyRedirect';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

// The proxy session is renewed in another tab, so this tab only learns about it
// by looking again. Re-probing when the user comes back lets the banner clear
// itself and the stale queries repaint, instead of requiring a reload that would
// discard everything the user had open.
export const useRecoverAuthProxySession = () => {
  const [isAuthProxySessionExpired, setIsAuthProxySessionExpired] =
    useAtomState(isAuthProxySessionExpiredState);
  const apolloClient = useApolloClient();

  // oxlint-disable-next-line twenty/no-state-useref
  const isRecheckingRef = useRef(false);

  useEffect(() => {
    if (!isAuthProxySessionExpired) {
      return;
    }

    const recheck = async () => {
      if (document.visibilityState !== 'visible' || isRecheckingRef.current) {
        return;
      }

      isRecheckingRef.current = true;

      try {
        const isStillRedirecting = await isAuthProxyRedirect(
          `${REACT_APP_SERVER_BASE_URL}/graphql`,
        );

        if (isStillRedirecting) {
          return;
        }

        setIsAuthProxySessionExpired(false);

        await apolloClient.refetchQueries({ include: 'active' });
      } catch {
        // A failed refetch leaves the queries as they were; the user can still
        // reload. Nothing here should throw into the event listener.
      } finally {
        isRecheckingRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);

    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, [isAuthProxySessionExpired, setIsAuthProxySessionExpired, apolloClient]);
};
