import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Provider } from 'jotai';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { IS_LOCAL_FIRST_WRITES_ENABLED } from '@/local-first/constants/IS_LOCAL_FIRST_WRITES_ENABLED';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import 'twenty-ui/theme-light.css';
import { getLocalFirstScopeKey } from '@/local-first/utils/getLocalFirstScopeKey';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { messages } from '~/locales/generated/en';

const PersonalWorkspace = lazy(() =>
  import('@/local-first/components/PersonalWorkspace').then((module) => ({
    default: module.PersonalWorkspace,
  })),
);

// This entry deliberately has no client-config, metadata or API startup gate.
// Opening local data requires the locally retained account/workspace identity;
// it does not issue or extend a server authentication session.
export const PersonalWorkspaceEntry = () => {
  const currentUser = useAtomStateValue(currentUserState);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const scope = useMemo(
    () =>
      currentUser && currentWorkspace
        ? {
            serverUrl: REACT_APP_SERVER_BASE_URL,
            userId: currentUser.id,
            workspaceId: currentWorkspace.id,
          }
        : null,
    [currentUser, currentWorkspace],
  );
  const [locked, setLocked] = useState(
    () => localStorage.getItem('twenty-personal-tools-locked') === 'true',
  );
  useEffect(() => {
    const refresh = () =>
      setLocked(
        localStorage.getItem('twenty-personal-tools-locked') === 'true',
      );
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);
  if (!IS_LOCAL_FIRST_WRITES_ENABLED || !scope || locked)
    return (
      <main>
        <h1>
          <Trans>Personal workspace closed</Trans>
        </h1>
        <p>
          <Trans>
            Open Personal tools from the experimental CRM to use this account's
            saved tools.
          </Trans>
        </p>
        <a href="/">
          <Trans>Back to CRM</Trans>
        </a>
      </main>
    );
  return (
    <Suspense
      fallback={
        <p>
          <Trans>Opening local tools…</Trans>
        </p>
      }
    >
      <PersonalWorkspace
        key={getLocalFirstScopeKey(scope)}
        scope={scope}
        onLock={() => {
          localStorage.setItem('twenty-personal-tools-locked', 'true');
          setLocked(true);
        }}
      />
    </Suspense>
  );
};

i18n.load('en', messages);
i18n.activate('en');
createRoot(document.getElementById('root') ?? document.body).render(
  <Provider store={jotaiStore}>
    <I18nProvider i18n={i18n}>
      <PersonalWorkspaceEntry />
    </I18nProvider>
  </Provider>,
);
