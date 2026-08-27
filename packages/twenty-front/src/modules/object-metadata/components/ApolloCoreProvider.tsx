import { useMemo } from 'react';

import { useApolloFactory } from '@/apollo/hooks/useApolloFactory';

import { IS_LOCAL_FIRST_ENABLED } from '@/local-first/constants/IS_LOCAL_FIRST_ENABLED';
import { createLocalFirstReadLink } from '@/local-first/services/createLocalFirstReadLink';
import { ApolloCoreClientContext } from '@/object-metadata/contexts/ApolloCoreClientContext';

export const ApolloCoreProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // Answers people list queries from the local mirror when it can, and
  // compares against the server when it cannot (or when serving is off). Off
  // unless the local-first flag is set; the link pulls in PGlite only on the
  // first list query.
  const extraLinks = useMemo(
    () => (IS_LOCAL_FIRST_ENABLED ? [createLocalFirstReadLink()] : []),
    [],
  );

  const apolloCoreClient = useApolloFactory({ extraLinks });

  return (
    <ApolloCoreClientContext.Provider value={apolloCoreClient}>
      {children}
    </ApolloCoreClientContext.Provider>
  );
};
