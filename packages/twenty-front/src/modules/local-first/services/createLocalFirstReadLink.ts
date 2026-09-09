import { ApolloLink, Observable } from '@apollo/client';

import { createLocalFirstQueryLink } from '@/local-first/services/createLocalFirstQueryLink';

import { assertLocalFirstScopeIsCurrent } from '@/local-first/services/getCurrentLocalFirstScope';
import { readLocalFirstTableStates } from '@/local-first/services/localFirstReplicaState';

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
    { getLocalFirstMirror },
    { buildLocalReadPlan },
    { executeLocalReadPlan },
  ] = await Promise.all([
    import('@/local-first/services/getLocalFirstMirror'),
    import('@/local-first/utils/buildLocalReadPlan'),
    import('@/local-first/services/executeLocalReadPlan'),
  ]);

  // Waiting for the mirror is safe because the caller races this against the
  // network: if booting PGlite takes seconds, the network answer simply wins
  // and this result is used only for the comparison.
  const { pg, scope, columnsByTable } = await getLocalFirstMirror();

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

  return pg.transaction(async (transaction) => {
    assertLocalFirstScopeIsCurrent(scope);
    const completedTables = new Set(
      (await readLocalFirstTableStates(transaction))
        .filter((state) => state.complete)
        .map((state) => state.tableName),
    );
    const pendingPlans = [planResult.plan];
    while (pendingPlans.length > 0) {
      const plan = pendingPlans.pop();
      if (!plan) break;
      if (!completedTables.has(plan.table)) {
        return {
          isSupported: false as const,
          reason: `table "${plan.table}" has not finished syncing`,
        };
      }
      pendingPlans.push(...plan.relations.map((relation) => relation.plan));
    }
    const nodes = await executeLocalReadPlan({
      pg: transaction,
      plan: planResult.plan,
      sql: translation.sql,
      params: translation.params,
    });
    const countResult = await transaction.query<{ count: number }>(
      translation.countSql,
    );
    assertLocalFirstScopeIsCurrent(scope);
    const totalCount = countResult.rows[0]?.count ?? 0;
    // Until cursor encoding is implemented, a partial page must use the
    // server's real cursors instead of incorrectly declaring the final page.
    if (nodes.length !== totalCount) {
      return {
        isSupported: false as const,
        reason: 'local cursor pagination is not supported',
      };
    }

    return {
      isSupported: true as const,
      result: { nodes, totalCount },
    };
  });
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

// Serving reads from a complete replica works without a network request.
// Shadow mode retains the server answer and compares it with the replica.
export const createLocalFirstReadLink = () => {
  if (IS_LOCAL_FIRST_READS_ENABLED) {
    return createLocalFirstQueryLink({
      operationName: PEOPLE_OPERATION_NAME,
      resolve: async (operation) => {
        const outcome = await resolveLocalPeople(operation);
        if (!outcome.isSupported) {
          recordReport({
            operationName: PEOPLE_OPERATION_NAME,
            outcome: 'unsupported',
            detail: outcome.reason,
          });
          return null;
        }
        recordReport({
          operationName: PEOPLE_OPERATION_NAME,
          outcome: 'servedLocally',
          detail: `${outcome.result.nodes.length} rows from local`,
        });
        return toConnectionResponse(outcome.result);
      },
    });
  }

  return new ApolloLink((operation, forward) => {
    if (operation.operationName !== PEOPLE_OPERATION_NAME) {
      return forward(operation);
    }

    const operationName = operation.operationName ?? 'unknown';

    return new Observable((observer) => {
      let isCancelled = false;
      let hasEmitted = false;
      let localOutcome: Awaited<ReturnType<typeof resolveLocalPeople>> | null =
        null;
      let serverRecords: Record<string, unknown>[] | null = null;
      let hasCompared = false;

      const emit = (value: unknown) => {
        if (isCancelled || hasEmitted) return false;

        hasEmitted = true;
        observer.next(value as Parameters<typeof observer.next>[0]);
        observer.complete();

        return true;
      };

      // Called from whichever side finishes second: the verdict needs both
      // answers, and either can arrive first. Deliberately not gated on the
      // subscription still being alive: on a fast connection the network
      // answers and Apollo unsubscribes long before the local read lands, and
      // suppressing the verdict then would hide every comparison.
      const compareWhenBothArrived = (servedLocally: boolean) => {
        if (hasCompared) return;
        if (localOutcome?.isSupported !== true || serverRecords === null)
          return;

        hasCompared = true;

        const comparison = compareLocalAndServerPeople({
          serverRecords,
          localRecords: localOutcome.result.nodes,
          requestedFields: extractRequestedNodeFields({
            query: operation.query,
            listFieldName: PEOPLE_LIST_FIELD,
          }),
        });

        const source = servedLocally ? 'served local' : 'served network';

        recordReport({
          operationName,
          outcome: comparison.isMatch ? 'match' : 'divergence',
          detail: comparison.isMatch
            ? `${source}, ${comparison.serverCount} rows agreed (${comparison.comparedFieldCount} fields)`
            : comparison.differences.join('; '),
        });
      };

      void (async () => {
        try {
          localOutcome = await resolveLocalPeople(operation);
        } catch (error) {
          recordReport({
            operationName,
            outcome: 'error',
            detail: error instanceof Error ? error.message : String(error),
          });

          return;
        }

        if (!localOutcome.isSupported) {
          recordReport({
            operationName,
            outcome: 'unsupported',
            detail: localOutcome.reason,
          });

          return;
        }

        const servedLocally =
          IS_LOCAL_FIRST_READS_ENABLED &&
          emit(toConnectionResponse(localOutcome.result));

        if (servedLocally) {
          recordReport({
            operationName,
            outcome: 'servedLocally',
            detail: `${localOutcome.result.nodes.length} rows from local`,
          });
        }

        compareWhenBothArrived(servedLocally);
      })();

      const subscription = forward(operation).subscribe({
        next: (response) => {
          const servedLocally = hasEmitted;

          emit(response);

          serverRecords = (
            (
              response.data as {
                people?: { edges?: { node?: Record<string, unknown> }[] };
              }
            )?.people?.edges ?? []
          )
            .map((edge) => edge?.node)
            .filter((node): node is Record<string, unknown> => !!node);

          compareWhenBothArrived(servedLocally);
        },
        error: (error) => {
          if (!hasEmitted) observer.error(error);
        },
        complete: () => {
          if (!hasEmitted) observer.complete();
        },
      });

      return () => {
        isCancelled = true;
        subscription.unsubscribe();
      };
    });
  });
};
