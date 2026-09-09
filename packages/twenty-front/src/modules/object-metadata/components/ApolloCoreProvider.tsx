import { useEffect, useMemo } from 'react';

import { useApolloFactory } from '@/apollo/hooks/useApolloFactory';

import { IS_LOCAL_FIRST_ENABLED } from '@/local-first/constants/IS_LOCAL_FIRST_ENABLED';
import { IS_LOCAL_FIRST_WRITES_ENABLED } from '@/local-first/constants/IS_LOCAL_FIRST_WRITES_ENABLED';
import { createLocalFirstJournalLink } from '@/local-first/services/createLocalFirstJournalLink';
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
    () => [
      ...(IS_LOCAL_FIRST_WRITES_ENABLED ? [createLocalFirstJournalLink()] : []),
      ...(IS_LOCAL_FIRST_ENABLED ? [createLocalFirstReadLink()] : []),
    ],
    [],
  );

  const apolloCoreClient = useApolloFactory({ extraLinks });

  useEffect(() => {
    if (!IS_LOCAL_FIRST_WRITES_ENABLED) return;
    const refresh = () => {
      void apolloCoreClient
        .refetchQueries({ include: 'active' })
        .catch(() => {});
    };
    window.addEventListener('twenty-local-changes-resolved', refresh);
    return () =>
      window.removeEventListener('twenty-local-changes-resolved', refresh);
  }, [apolloCoreClient]);

  return (
    <ApolloCoreClientContext.Provider value={apolloCoreClient}>
      {children}
    </ApolloCoreClientContext.Provider>
  );
};
