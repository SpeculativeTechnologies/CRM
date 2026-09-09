import { type CoreApiClient } from 'twenty-client-sdk/core';

import { type ContactLogDirection } from 'src/constants/contact-log-options';
import { executeWithRetry } from 'src/utils/execute-with-retry';

export type ContactLogInteraction = {
  id: string;
  personId: string;
  occurredAt: string;
  direction: ContactLogDirection;
  workspaceMemberId: string | null;
};

type ContactLogNode = {
  id: string;
  personId?: string | null;
  occurredAt?: string | null;
  direction?: string | null;
  createdBy?: { workspaceMemberId?: string | null } | null;
};

const PAGE_SIZE = 200;

export const collectContactLogInteractions = async (
  client: CoreApiClient,
  personIds: string[],
): Promise<ContactLogInteraction[]> => {
  const interactions: ContactLogInteraction[] = [];
  const now = new Date().toISOString();

  for (let offset = 0; offset < personIds.length; offset += PAGE_SIZE) {
    let after: string | undefined;

    do {
      const { contactLogs } = await executeWithRetry(() =>
        client.query({
          contactLogs: {
            __args: {
              filter: {
                personId: { in: personIds.slice(offset, offset + PAGE_SIZE) },
                occurredAt: { lte: now },
              },
              first: PAGE_SIZE,
              after,
            },
            edges: {
              node: {
                id: true,
                personId: true,
                occurredAt: true,
                direction: true,
                createdBy: { workspaceMemberId: true },
              },
            },
            pageInfo: { hasNextPage: true, endCursor: true },
          },
        }),
      );

      for (const edge of contactLogs?.edges ?? []) {
        const log = edge.node as ContactLogNode;
        const timestamp = log.occurredAt ? Date.parse(log.occurredAt) : NaN;

        if (
          !log.personId ||
          !Number.isFinite(timestamp) ||
          timestamp > Date.parse(now)
        ) {
          continue;
        }
        if (
          log.direction !== 'OUTBOUND' &&
          log.direction !== 'INBOUND' &&
          log.direction !== 'BOTH'
        ) {
          continue;
        }

        interactions.push({
          id: log.id,
          personId: log.personId,
          occurredAt: new Date(timestamp).toISOString(),
          direction: log.direction,
          workspaceMemberId: log.createdBy?.workspaceMemberId ?? null,
        });
      }
      after = contactLogs?.pageInfo.hasNextPage
        ? (contactLogs.pageInfo.endCursor ?? undefined)
        : undefined;
    } while (after);
  }

  return interactions;
};
