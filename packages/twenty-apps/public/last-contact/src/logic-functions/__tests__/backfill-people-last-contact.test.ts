import type * as PersonLastContactAggregation from 'src/utils/person-last-contact-aggregation';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, mutation, aggregate, recompute } = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
  aggregate: vi.fn(),
  recompute: vi.fn(),
}));
vi.mock('twenty-client-sdk/core', () => ({
  CoreApiClient: vi.fn(function () {
    return { query, mutation };
  }),
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

import definition from 'src/logic-functions/backfill-people-last-contact';

const handler = definition.config.handler as (payload: {
  batchId: number;
}) => Promise<object>;

beforeEach(() => {
  vi.clearAllMocks();
  query.mockResolvedValue({
    people: { edges: [{ node: { id: 'person-1', lastContactAt: null } }] },
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
    await handler({ batchId: 0 });
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
    await handler({ batchId: 0 });
    expect(recompute).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      'person-1',
    );
  });
});
