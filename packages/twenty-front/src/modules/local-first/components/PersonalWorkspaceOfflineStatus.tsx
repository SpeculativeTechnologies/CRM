import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';

import { StyledPersonalToolActions } from '@/local-first/components/PersonalToolStyles';
import {
  isPersonalWorkspaceReadyOffline,
  preparePersonalWorkspaceOffline,
  removePersonalWorkspaceOffline,
} from '@/local-first/services/preparePersonalWorkspaceOffline';

export const PersonalWorkspaceOfflineStatus = () => {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const refresh = () => {
      void isPersonalWorkspaceReadyOffline()
        .then(setReady)
        .catch(() => setReady(false));
    };
    navigator.serviceWorker?.addEventListener('controllerchange', refresh);
    refresh();
    return () =>
      navigator.serviceWorker?.removeEventListener('controllerchange', refresh);
  }, []);
  const prepare = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await preparePersonalWorkspaceOffline();
      setReady(await isPersonalWorkspaceReadyOffline());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <StyledPersonalToolActions>
        <small>
          {ready ? (
            <Trans>Personal workspace ready for offline reopening</Trans>
          ) : (
            <Trans>
              Personal data is saved locally. Prepare this page before reopening
              offline.
            </Trans>
          )}
        </small>
        {import.meta.env.DEV ? (
          <small>
            <Trans>Offline startup is tested in the built preview.</Trans>
          </small>
        ) : (
          <button disabled={busy} onClick={() => void prepare()}>
            <Trans>Prepare offline copy</Trans>
          </button>
        )}
        {ready && (
          <button
            onClick={() =>
              void removePersonalWorkspaceOffline()
                .then(() => setReady(false))
                .catch(() => setFailed(true))
            }
          >
            <Trans>Remove offline copy</Trans>
          </button>
        )}
      </StyledPersonalToolActions>
      {failed && (
        <p role="alert">
          <Trans>
            The offline copy could not be prepared. Keep this page open and
            retry with a connection. Your tools are still saved on this device.
          </Trans>
        </p>
      )}
    </>
  );
};
