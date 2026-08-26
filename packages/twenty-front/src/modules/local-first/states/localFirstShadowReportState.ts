import { atom } from 'jotai';

export type LocalFirstShadowReport = {
  operationName: string;
  // 'match' | 'divergence' | 'unsupported' | 'error'
  outcome: 'match' | 'divergence' | 'unsupported' | 'error';
  detail: string;
};

export type LocalFirstShadowReportState = {
  matchCount: number;
  divergenceCount: number;
  unsupportedCount: number;
  errorCount: number;
  recentReports: LocalFirstShadowReport[];
};

export const LOCAL_FIRST_SHADOW_REPORT_INITIAL_STATE: LocalFirstShadowReportState =
  {
    matchCount: 0,
    divergenceCount: 0,
    unsupportedCount: 0,
    errorCount: 0,
    recentReports: [],
  };

export const localFirstShadowReportState = atom<LocalFirstShadowReportState>(
  LOCAL_FIRST_SHADOW_REPORT_INITIAL_STATE,
);
