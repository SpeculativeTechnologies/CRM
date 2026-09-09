import { Trans } from '@lingui/react/macro';
import { useEffect, useState } from 'react';

import { StyledPersonalToolActions } from '@/local-first/components/PersonalToolStyles';
import {
  isPersonalWorkspaceReadyOffline,
  preparePersonalWorkspaceOffline,
  removePersonalWorkspaceOffline,
} from '@/local-first/services/preparePersonalWorkspaceOffline';

const OFFLINE_DISABLED_KEY = 'twenty-personal-offline-disabled';

type PersonalWorkspaceOfflineStatusProps = { isBuilt: boolean };

export const PersonalWorkspaceOfflineStatus = ({
  isBuilt,
}: PersonalWorkspaceOfflineStatusProps) => {
  const [disabled, setDisabled] = useState(
    () => localStorage.getItem(OFFLINE_DISABLED_KEY) === 'true',
  );
  const [status, setStatus] = useState<'preparing' | 'ready' | 'failed'>(
    'preparing',
  );
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [removeFailed, setRemoveFailed] = useState(false);
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === OFFLINE_DISABLED_KEY || event.key === null)
        setDisabled(localStorage.getItem(OFFLINE_DISABLED_KEY) === 'true');
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);
  useEffect(() => {
    if (!isBuilt || disabled) return;
    let stopped = false;
    let preparing = false;
    const prepare = async () => {
      if (preparing || stopped) return;
      preparing = true;
      try {
        // An existing copy must stay usable when the server is unreachable.
        const ready = await isPersonalWorkspaceReadyOffline();
        if (stopped) return;
        setStatus(ready ? 'ready' : 'preparing');
        if (!ready) await preparePersonalWorkspaceOffline();
        if (!stopped) setStatus('ready');
      } catch {
        if (!stopped) setStatus('failed');
      } finally {
        preparing = false;
      }
    };
    const refresh = () => void prepare();
    window.addEventListener('online', refresh);
    refresh();
    return () => {
      stopped = true;
      window.removeEventListener('online', refresh);
    };
  }, [isBuilt, disabled, attempt]);
  const enable = () => {
    try {
      localStorage.removeItem(OFFLINE_DISABLED_KEY);
      setDisabled(false);
      setStatus('preparing');
      setRemoveFailed(false);
      setAttempt((previous) => previous + 1);
    } catch {
      setStatus('failed');
    }
  };
  const remove = async () => {
    setBusy(true);
    setRemoveFailed(false);
    try {
      // Removal is an explicit opt-out, including on the next visit.
      localStorage.setItem(OFFLINE_DISABLED_KEY, 'true');
      setDisabled(true);
      await removePersonalWorkspaceOffline();
    } catch {
      setRemoveFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <StyledPersonalToolActions>
        <small role="status">
          {!isBuilt ? (
            <Trans>Offline startup is tested in the built preview.</Trans>
          ) : disabled ? (
            <Trans>Automatic offline access is turned off.</Trans>
          ) : status === 'ready' ? (
            <Trans>Personal workspace ready for offline reopening</Trans>
          ) : status === 'preparing' ? (
            <Trans>Preparing offline access automatically…</Trans>
          ) : (
            <Trans>Your tools are saved on this device.</Trans>
          )}
        </small>
        {isBuilt && disabled && (
          <button disabled={busy} onClick={enable}>
            <Trans>Enable offline access</Trans>
          </button>
        )}
        {isBuilt && !disabled && status === 'failed' && (
          <button onClick={enable}>
            <Trans>Retry offline preparation</Trans>
          </button>
        )}
        {isBuilt && ((!disabled && status === 'ready') || removeFailed) && (
          <button disabled={busy} onClick={() => void remove()}>
            <Trans>Remove offline copy</Trans>
          </button>
        )}
      </StyledPersonalToolActions>
      {isBuilt && !disabled && status === 'failed' && (
        <p role="alert">
          <Trans>
            Offline access could not be prepared. We will retry when your
            connection returns. Your tools are still saved on this device.
          </Trans>
        </p>
      )}
      {removeFailed && (
        <p role="alert">
          <Trans>The offline copy could not be removed. Try again.</Trans>
        </p>
      )}
    </>
  );
};
