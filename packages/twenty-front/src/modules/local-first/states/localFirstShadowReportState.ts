import { atom } from 'jotai';

export type LocalFirstShadowReport = {
  operationName: string;
  outcome: 'servedLocally' | 'match' | 'divergence' | 'unsupported' | 'error';
  detail: string;
};

export type LocalFirstShadowReportState = {
  servedLocallyCount: number;
  matchCount: number;
  divergenceCount: number;
  unsupportedCount: number;
  errorCount: number;
  recentReports: LocalFirstShadowReport[];
};

export const LOCAL_FIRST_SHADOW_REPORT_INITIAL_STATE: LocalFirstShadowReportState =
  {
    servedLocallyCount: 0,
    matchCount: 0,
    divergenceCount: 0,
    unsupportedCount: 0,
    errorCount: 0,
    recentReports: [],
  };

export const localFirstShadowReportState = atom<LocalFirstShadowReportState>(
  LOCAL_FIRST_SHADOW_REPORT_INITIAL_STATE,
);
