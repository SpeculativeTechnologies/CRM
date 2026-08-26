import { ApolloLink } from '@apollo/client';
import { tap } from 'rxjs';
import { isDefined } from 'twenty-shared/utils';

import {
  type LocalFirstShadowReport,
  localFirstShadowReportState,
} from '@/local-first/states/localFirstShadowReportState';
import { appendLocalFirstShadowReport } from '@/local-first/utils/appendLocalFirstShadowReport';
import { buildLocalPersonQuery } from '@/local-first/utils/buildLocalPersonQuery';
import { assessLocalPersonFieldCoverage } from '@/local-first/utils/assessLocalPersonFieldCoverage';
import { compareLocalAndServerPeople } from '@/local-first/utils/compareLocalAndServerPeople';
import { extractRequestedNodeFields } from '@/local-first/utils/extractRequestedNodeFields';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { logDebug } from '~/utils/logDebug';

const SHADOWED_OPERATION_NAME = 'FindManyPeople';

const recordReport = (report: LocalFirstShadowReport) => {
  // jotaiStore is reassigned on reset, so it is read at call time rather than
  // captured when this link is built.
  jotaiStore.set(localFirstShadowReportState, (state) =>
    appendLocalFirstShadowReport(state, report),
  );

  if (report.outcome === 'divergence') {
    logDebug(`[local-first] divergence: ${report.detail}`);
  }
};

const extractServerRecords = (data: unknown): Record<string, unknown>[] => {
  const edges = (data as { people?: { edges?: { node?: unknown }[] } })?.people
    ?.edges;

  if (!Array.isArray(edges)) return [];

  return edges.map((edge) => edge?.node).filter(isDefined) as Record<
    string,
    unknown
  >[];
};

// Compares what the server returned for a people list query against what the
// locally synced database would have returned for the same query, and records
// the verdict. It never alters the response: rendering still comes entirely
// from the server, so this can be left on while confidence is built, and a
// translation gap shows up as a logged report instead of a wrong row.
export const createLocalFirstShadowCompareLink = () =>
  new ApolloLink((operation, forward) =>
    forward(operation).pipe(
      tap((result) => {
        if (operation.operationName !== SHADOWED_OPERATION_NAME) return;

        // Fire and forget: the comparison must never delay or fail the
        // response the app is rendering from.
        void (async () => {
          try {
            // Awaiting the shared mirror rather than reading state avoids
            // racing the schema fetch: the first list query of a page load
            // otherwise arrives before any columns are known.
            const { getLocalFirstPersonMirror } =
              await import('@/local-first/services/getLocalFirstPersonMirror');
            const { pg, columnNames: syncedColumns } =
              await getLocalFirstPersonMirror();

            const translation = buildLocalPersonQuery({
              ...operation.variables,
              syncedColumns,
            });

            if (!translation.isSupported) {
              recordReport({
                operationName: operation.operationName ?? 'unknown',
                outcome: 'unsupported',
                detail: translation.reason,
              });

              return;
            }

            const requestedFields = extractRequestedNodeFields({
              query: operation.query,
              listFieldName: 'people',
            });
            const coverage = assessLocalPersonFieldCoverage({
              requestedFields,
              syncedColumns,
            });

            if (!coverage.isCovered) {
              recordReport({
                operationName: operation.operationName ?? 'unknown',
                outcome: 'unsupported',
                detail: `fields not synced: ${coverage.missingFields.join(', ')}`,
              });

              return;
            }

            const serverRecords = extractServerRecords(result.data);
            const localResult = await pg.query<Record<string, unknown>>(
              translation.sql,
              translation.params,
            );

            const comparison = compareLocalAndServerPeople({
              serverRecords,
              localRecords: localResult.rows,
              requestedFields,
              syncedColumns,
            });

            recordReport({
              operationName: operation.operationName ?? 'unknown',
              outcome: comparison.isMatch ? 'match' : 'divergence',
              detail: comparison.isMatch
                ? `${comparison.serverCount} rows agreed`
                : comparison.differences.join('; '),
            });
          } catch (error) {
            recordReport({
              operationName: operation.operationName ?? 'unknown',
              outcome: 'error',
              detail: error instanceof Error ? error.message : String(error),
            });
          }
        })();
      }),
    ),
  );
