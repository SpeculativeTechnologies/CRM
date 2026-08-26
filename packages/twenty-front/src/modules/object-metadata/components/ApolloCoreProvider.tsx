import { useMemo } from 'react';

import { useApolloFactory } from '@/apollo/hooks/useApolloFactory';

import { IS_LOCAL_FIRST_ENABLED } from '@/local-first/constants/IS_LOCAL_FIRST_ENABLED';
import { createLocalFirstShadowCompareLink } from '@/local-first/services/createLocalFirstShadowCompareLink';
import { ApolloCoreClientContext } from '@/object-metadata/contexts/ApolloCoreClientContext';

export const ApolloCoreProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // Observes record list responses and compares them against the locally
  // synced database without altering them. Off unless the local-first flag is
  // set; the link itself pulls in PGlite only on first comparison.
  const extraLinks = useMemo(
    () => (IS_LOCAL_FIRST_ENABLED ? [createLocalFirstShadowCompareLink()] : []),
    [],
  );

  const apolloCoreClient = useApolloFactory({ extraLinks });

  return (
    <ApolloCoreClientContext.Provider value={apolloCoreClient}>
      {children}
    </ApolloCoreClientContext.Provider>
  );
};
