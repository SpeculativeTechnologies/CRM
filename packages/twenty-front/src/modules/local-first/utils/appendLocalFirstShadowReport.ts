import {
  type LocalFirstShadowReport,
  type LocalFirstShadowReportState,
} from '@/local-first/states/localFirstShadowReportState';

const MAX_RETAINED_REPORTS = 20;

const OUTCOME_COUNT_KEYS = {
  servedLocally: 'servedLocallyCount',
  match: 'matchCount',
  divergence: 'divergenceCount',
  unsupported: 'unsupportedCount',
  error: 'errorCount',
} as const;

// Newest first, capped: this is a debugging surface, not an audit log, and it
// runs on every list query while the flag is on.
export const appendLocalFirstShadowReport = (
  state: LocalFirstShadowReportState,
  report: LocalFirstShadowReport,
): LocalFirstShadowReportState => {
  const countKey = OUTCOME_COUNT_KEYS[report.outcome];

  return {
    ...state,
    [countKey]: state[countKey] + 1,
    recentReports: [report, ...state.recentReports].slice(
      0,
      MAX_RETAINED_REPORTS,
    ),
  };
};
