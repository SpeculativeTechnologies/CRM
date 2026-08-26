import { styled } from '@linaria/react';
import { useAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { startLocalFirstSync } from '@/local-first/services/startLocalFirstSync';
import { localFirstShadowReportState } from '@/local-first/states/localFirstShadowReportState';
import { localFirstSyncStatusState } from '@/local-first/states/localFirstSyncStatusState';

const StyledPanel = styled.div`
  background: ${themeCssVariables.background.invertedPrimary};
  border-radius: ${themeCssVariables.border.radius.md};
  bottom: 16px;
  color: ${themeCssVariables.font.color.inverted};
  font-family: ${themeCssVariables.code.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  max-height: 320px;
  overflow-y: auto;
  padding: 8px 12px;
  position: fixed;
  right: 16px;
  width: 360px;
  z-index: 9999;
`;

const StyledRow = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.secondaryInverted};
  padding: 2px 0;
`;

// Spike-only surface for the local-first read path: sync status across the
// mirrored tables, and the verdict on every people list query (served locally,
// or compared against the server and found to agree or diverge).
export const LocalFirstDebugPanel = () => {
  const [status, setStatus] = useAtom(localFirstSyncStatusState);
  const [report] = useAtom(localFirstShadowReportState);
  const [tableSummary, setTableSummary] = useState('resolving schema');

  useEffect(() => {
    startLocalFirstSync({
      onStatusChange: setStatus,
      onTablesResolved: (columnsByTable) => {
        setTableSummary(
          Object.entries(columnsByTable)
            .map(([table, columns]) => `${table}:${columns.length}`)
            .join(' '),
        );
      },
    });
  }, [setStatus]);

  return (
    <StyledPanel>
      <div>local-first: {status}</div>
      <StyledRow>{tableSummary}</StyledRow>
      <StyledRow>
        {report.servedLocallyCount} served · {report.matchCount} agreed ·{' '}
        {report.divergenceCount} diverged · {report.unsupportedCount} skipped ·{' '}
        {report.errorCount} errored
      </StyledRow>
      {report.recentReports.slice(0, 5).map((entry, index) => (
        <StyledRow key={`${entry.outcome}-${index}`}>
          {entry.outcome}: {entry.detail}
        </StyledRow>
      ))}
    </StyledPanel>
  );
};
