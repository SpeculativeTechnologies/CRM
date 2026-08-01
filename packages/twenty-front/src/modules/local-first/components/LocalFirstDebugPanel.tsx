import { styled } from '@linaria/react';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { LOCAL_FIRST_WORKSPACE_SCHEMA } from '@/local-first/constants/LOCAL_FIRST_WORKSPACE_SCHEMA';
import { useLocalFirstPersonRecords } from '@/local-first/hooks/useLocalFirstPersonRecords';
import { startSyncingPersonShapeToLocalFirstDatabase } from '@/local-first/services/syncPersonShapeToLocalFirstDatabase';
import { localFirstSyncStatusState } from '@/local-first/states/localFirstSyncStatusState';

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

  useEffect(() => {
    startSyncingPersonShapeToLocalFirstDatabase({ onStatusChange: setStatus });
  }, [setStatus]);

  if (!isDefined(LOCAL_FIRST_WORKSPACE_SCHEMA)) return null;

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
