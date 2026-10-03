import type * as PersonLastContactAggregation from 'src/utils/person-last-contact-aggregation';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, mutation, aggregate, recompute } = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
  aggregate: vi.fn(),
  recompute: vi.fn(),
}));
vi.mock('src/utils/recompute-person-last-contact', () => ({
  recomputePersonLastContact: recompute,
}));
vi.mock(
  'src/utils/person-last-contact-aggregation',
  async (importOriginal) => ({
    ...(await importOriginal<typeof PersonLastContactAggregation>()),
    buildPersonAggregates: aggregate,
  }),
);

import { backfillPeopleLastContact } from 'src/utils/backfill-people-last-contact';
import { type CoreApiClient } from 'twenty-client-sdk/core';

const client = { query, mutation } as unknown as CoreApiClient;

beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue({
    people: {
      edges: [{ node: { id: 'person-1', lastContactAt: null } }],
      pageInfo: { hasNextPage: false },
    },
  });
  aggregate.mockResolvedValue(
    new Map([
      [
        'person-1',
        {
          lastContactAt: '2025-06-01T12:00:00.000Z',
          item: { kind: 'manual', id: 'log-1' },
        },
      ],
    ]),
  );
});

describe('contact backfill', () => {
  it('should save the manual source when the contact has not changed during backfill', async () => {
    mutation.mockResolvedValue({ updatePeople: [{ id: 'person-1' }] });
    await backfillPeopleLastContact(client, ['person-1']);
    expect(mutation.mock.calls[0][0].updatePeople.__args.data).toMatchObject({
      lastContactItemContactLogId: 'log-1',
    });
    expect(
      mutation.mock.calls[0][0].updatePeople.__args.filter.and,
    ).toContainEqual({ lastContactAt: { is: 'NULL' } });
    expect(recompute).not.toHaveBeenCalled();
  });

  it('should recompute from current interactions instead of overwriting a concurrent contact', async () => {
    mutation.mockResolvedValue({ updatePeople: [] });
    await backfillPeopleLastContact(client, ['person-1']);
    expect(recompute).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      'person-1',
    );
  });
});
