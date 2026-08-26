import { ApolloLink, Observable } from '@apollo/client';
import { tap } from 'rxjs';

import { IS_LOCAL_FIRST_READS_ENABLED } from '@/local-first/constants/IS_LOCAL_FIRST_READS_ENABLED';
import {
  type LocalFirstShadowReport,
  localFirstShadowReportState,
} from '@/local-first/states/localFirstShadowReportState';
import { appendLocalFirstShadowReport } from '@/local-first/utils/appendLocalFirstShadowReport';
import { buildLocalPersonQuery } from '@/local-first/utils/buildLocalPersonQuery';
import { compareLocalAndServerPeople } from '@/local-first/utils/compareLocalAndServerPeople';
import { extractRequestedNodeFields } from '@/local-first/utils/extractRequestedNodeFields';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { isDefined } from 'twenty-shared/utils';

const PEOPLE_OPERATION_NAME = 'FindManyPeople';
const PEOPLE_LIST_FIELD = 'people';
const PERSON_TABLE = 'person';

const recordReport = (report: LocalFirstShadowReport) => {
  // jotaiStore is reassigned on reset, so it is read at call time rather than
  // captured when this link is built.
  jotaiStore.set(localFirstShadowReportState, (state) =>
    appendLocalFirstShadowReport(state, report),
  );
};

type LocalPeopleResult = {
  nodes: Record<string, unknown>[];
  totalCount: number;
};

// Everything needed to answer a people list query from the mirror, or a reason
// it cannot be answered. Kept separate from the link so both the read path and
// the shadow comparison run the identical resolution.
export const resolveLocalPeople = async (
  operation: Pick<ApolloLink.Operation, 'query' | 'variables'>,
): Promise<
  | { isSupported: true; result: LocalPeopleResult }
  | { isSupported: false; reason: string }
> => {
  const [
    { tryGetReadyLocalFirstMirror },
    { buildLocalReadPlan },
    { executeLocalReadPlan },
  ] = await Promise.all([
    import('@/local-first/services/getLocalFirstMirror'),
    import('@/local-first/utils/buildLocalReadPlan'),
    import('@/local-first/services/executeLocalReadPlan'),
  ]);

  // Only serve from a mirror that is already built. Waiting for PGlite to boot
  // would make a cold page slower than simply asking the server.
  const mirror = tryGetReadyLocalFirstMirror();

  if (!isDefined(mirror)) {
    return { isSupported: false, reason: 'mirror not ready yet' };
  }

  const { pg, columnsByTable } = mirror;

  const planResult = buildLocalReadPlan({
    table: PERSON_TABLE,
    requestedFields: extractRequestedNodeFields({
      query: operation.query,
      listFieldName: PEOPLE_LIST_FIELD,
    }),
    columnsByTable,
  });

  if (!planResult.isSupported) {
    return { isSupported: false, reason: planResult.reason };
  }

  const translation = buildLocalPersonQuery({
    ...operation.variables,
    selectColumns: planResult.plan.columns,
    orderableColumns: columnsByTable[PERSON_TABLE],
  });

  if (!translation.isSupported) {
    return { isSupported: false, reason: translation.reason };
  }

  const nodes = await executeLocalReadPlan({
    pg,
    plan: planResult.plan,
    sql: translation.sql,
    params: translation.params,
  });

  // totalCount is what the table's footer and paging rely on, so it has to be
  // the count of the filtered set rather than the page.
  const countResult = await pg.query<{ count: number }>(
    'select count(*)::int as count from person where "deletedAt" is null',
  );

  return {
    isSupported: true,
    result: { nodes, totalCount: countResult.rows[0]?.count ?? 0 },
  };
};

const toConnectionResponse = ({ nodes, totalCount }: LocalPeopleResult) => ({
  data: {
    [PEOPLE_LIST_FIELD]: {
      __typename: 'PersonConnection',
      edges: nodes.map((node) => ({
        __typename: 'PersonEdge',
        node,
        cursor: '',
      })),
      pageInfo: {
        __typename: 'PageInfo',
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: '',
        endCursor: '',
      },
      totalCount,
    },
  },
});

// Answers people list queries from the local mirror when it can, and forwards
// to the network when it cannot. Serving locally takes the network out of the
// interactive path entirely; anything the plan does not fully understand falls
// through and behaves exactly as before.
export const createLocalFirstReadLink = () =>
  new ApolloLink((operation, forward) => {
    if (operation.operationName !== PEOPLE_OPERATION_NAME) {
      return forward(operation);
    }

    return new Observable((observer) => {
      let isCancelled = false;

      void (async () => {
        let localResult: Awaited<ReturnType<typeof resolveLocalPeople>> | null =
          null;

        try {
          localResult = await resolveLocalPeople(operation);
        } catch (error) {
          recordReport({
            operationName: operation.operationName ?? 'unknown',
            outcome: 'error',
            detail: error instanceof Error ? error.message : String(error),
          });
        }

        if (isCancelled) return;

        if (localResult?.isSupported === true && IS_LOCAL_FIRST_READS_ENABLED) {
          recordReport({
            operationName: operation.operationName ?? 'unknown',
            outcome: 'servedLocally',
            detail: `${localResult.result.nodes.length} rows from local`,
          });

          observer.next(toConnectionResponse(localResult.result));
          observer.complete();

          return;
        }

        // Not served locally: forward, and use the response to check what the
        // local read would have returned.
        forward(operation)
          .pipe(
            tap((response) => {
              if (localResult?.isSupported !== true) {
                recordReport({
                  operationName: operation.operationName ?? 'unknown',
                  outcome: 'unsupported',
                  detail: localResult?.reason ?? 'local read unavailable',
                });

                return;
              }

              const serverEdges =
                (
                  response.data as {
                    people?: { edges?: { node?: Record<string, unknown> }[] };
                  }
                )?.people?.edges ?? [];

              const comparison = compareLocalAndServerPeople({
                serverRecords: serverEdges
                  .map((edge) => edge?.node)
                  .filter((node): node is Record<string, unknown> => !!node),
                localRecords: localResult.result.nodes,
                requestedFields: extractRequestedNodeFields({
                  query: operation.query,
                  listFieldName: PEOPLE_LIST_FIELD,
                }),
              });

              recordReport({
                operationName: operation.operationName ?? 'unknown',
                outcome: comparison.isMatch ? 'match' : 'divergence',
                detail: comparison.isMatch
                  ? `${comparison.serverCount} rows agreed (${comparison.comparedFieldCount} fields)`
                  : comparison.differences.join('; '),
              });
            }),
          )
          .subscribe({
            next: (value) => observer.next(value),
            error: (error) => observer.error(error),
            complete: () => observer.complete(),
          });
      })();

      return () => {
        isCancelled = true;
      };
    });
  });
