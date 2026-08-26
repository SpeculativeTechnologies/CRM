import { styled } from '@linaria/react';
import { useAtom, useStore } from 'jotai';
import { useCallback, useEffect } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { isCookieAuthActiveState } from '@/auth/states/isCookieAuthActiveState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { IS_LOCAL_FIRST_ENABLED } from '@/local-first/constants/IS_LOCAL_FIRST_ENABLED';
import { useLocalFirstPersonRecords } from '@/local-first/hooks/useLocalFirstPersonRecords';
import { startSyncingPersonShapeToLocalFirstDatabase } from '@/local-first/services/syncPersonShapeToLocalFirstDatabase';
import { localFirstSyncStatusState } from '@/local-first/states/localFirstSyncStatusState';
import { getSseClientAuthHeaders } from '@/sse-db-event/utils/getSseClientAuthHeaders';

const StyledPanel = styled.div`
  background: ${themeCssVariables.background.invertedPrimary};
  border-radius: ${themeCssVariables.border.radius.md};
  bottom: 16px;
  color: ${themeCssVariables.font.color.inverted};
  font-family: ${themeCssVariables.code.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  max-height: 260px;
  overflow-y: auto;
  padding: 8px 12px;
  position: fixed;
  right: 16px;
  width: 320px;
  z-index: 9999;
`;

const StyledRow = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.secondaryInverted};
  padding: 2px 0;
`;

// Spike-only: proves person data can be read from a local PGlite database kept
// in sync with Electric while the real app is running, ahead of wiring
// local-first reads into the actual record tables/pages.
export const LocalFirstDebugPanel = () => {
  const [status, setStatus] = useAtom(localFirstSyncStatusState);
  const { records, totalCount } = useLocalFirstPersonRecords();
  const store = useStore();

  // Same auth contract as the SSE client: cookie mode rides on
  // credentials: 'include', token mode sends the bearer, read fresh from the
  // store on every request because the sync loop outlives any one token.
  const getAuthHeaders = useCallback(
    () =>
      getSseClientAuthHeaders({
        isCookieAuthActive: store.get(isCookieAuthActiveState.atom),
        tokenPair: store.get(tokenPairState.atom),
      }),
    [store],
  );

  useEffect(() => {
    startSyncingPersonShapeToLocalFirstDatabase({
      onStatusChange: setStatus,
      getAuthHeaders,
    });
  }, [setStatus, getAuthHeaders]);

  if (!IS_LOCAL_FIRST_ENABLED) return null;

  return (
    <StyledPanel>
      <div>
        local-first spike: {status} · {totalCount} rows locally
      </div>
      {records.map((record) => (
        <StyledRow key={record.id}>
          {record.nameFirstName} — {record.jobTitle ?? 'n/a'}
        </StyledRow>
      ))}
    </StyledPanel>
  );
};
