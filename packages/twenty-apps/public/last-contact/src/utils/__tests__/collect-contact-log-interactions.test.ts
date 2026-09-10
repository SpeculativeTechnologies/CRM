import { type CoreApiClient } from 'twenty-client-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import { collectContactLogInteractions } from 'src/utils/collect-contact-log-interactions';

const node = (id: string) => ({
  id,
  personId: 'person-1',
  occurredAt: '2025-01-01T12:00:00Z',
  direction: 'OUTBOUND',
});

describe('contact log history', () => {
  it('should include the complete history when it spans multiple pages', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        contactLogs: {
          edges: [{ node: node('first') }],
          pageInfo: { hasNextPage: true, endCursor: 'next-page' },
        },
      })
      .mockResolvedValueOnce({
        contactLogs: {
          edges: [{ node: node('second') }],
          pageInfo: { hasNextPage: false },
        },
      });
    const logs = await collectContactLogInteractions(
      { query } as unknown as CoreApiClient,
      ['person-1'],
    );
    expect(logs.map((log) => log.id)).toEqual(['first', 'second']);
    expect(query.mock.calls[1][0].contactLogs.__args.after).toBe('next-page');
  });

  it('should avoid querying contact logs when no people are in the batch', async () => {
    const query = vi.fn();
    expect(
      await collectContactLogInteractions(
        { query } as unknown as CoreApiClient,
        [],
      ),
    ).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
