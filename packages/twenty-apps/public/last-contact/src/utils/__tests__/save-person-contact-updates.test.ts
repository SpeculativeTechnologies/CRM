import { type CoreApiClient } from 'twenty-client-sdk/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recompute } = vi.hoisted(() => ({ recompute: vi.fn() }));
vi.mock('src/utils/recompute-person-last-contact', () => ({
  recomputePersonLastContact: recompute,
}));

import { savePersonContactUpdates } from 'src/utils/save-person-contact-updates';

beforeEach(() => vi.clearAllMocks());

describe('person contact snapshot writes', () => {
  it('should reject changes to every recency/source field since the batch read', async () => {
    const mutation = vi
      .fn()
      .mockResolvedValue({ updatePeople: [{ id: 'person-1' }] });
    const client = { mutation } as unknown as CoreApiClient;
    const snapshot = {
      lastContactAt: '2026-06-10T12:00:00.000Z',
      lastOutboundAt: '2026-06-09T12:00:00.000Z',
      lastEmailId: 'email-1',
      lastContactItemContactLogId: 'log-1',
    };

    await savePersonContactUpdates(
      client,
      [{ id: 'person-1', lastEmailId: 'email-2' }],
      new Map([['person-1', snapshot]]),
    );

    expect(mutation.mock.calls[0][0].updatePeople.__args).toEqual({
      data: { lastEmailId: 'email-2' },
      filter: {
        and: [
          { id: { eq: 'person-1' } },
          { lastContactAt: { eq: snapshot.lastContactAt } },
          { lastContactById: { is: 'NULL' } },
          { lastOutboundAt: { eq: snapshot.lastOutboundAt } },
          { lastInboundAt: { is: 'NULL' } },
          { lastEmailId: { eq: 'email-1' } },
          { lastMeetingId: { is: 'NULL' } },
          { lastContactItemMessageId: { is: 'NULL' } },
          { lastContactItemCalendarEventId: { is: 'NULL' } },
          { lastContactItemContactLogId: { eq: 'log-1' } },
        ],
      },
    });
    expect(recompute).not.toHaveBeenCalled();
  });

  it('should recompute after a failed conditional write without creating the person', async () => {
    const mutation = vi.fn().mockResolvedValue({ updatePeople: [] });
    const client = { mutation } as unknown as CoreApiClient;

    await savePersonContactUpdates(
      client,
      [{ id: 'person-1', lastEmailId: 'email-2' }],
      new Map([['person-1', {}]]),
    );

    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation.mock.calls[0][0]).not.toHaveProperty('createPeople');
    expect(recompute).toHaveBeenCalledExactlyOnceWith(client, 'person-1');
  });

  it('should not create a person absent from the collected batch', async () => {
    const mutation = vi.fn();
    await savePersonContactUpdates(
      { mutation } as unknown as CoreApiClient,
      [{ id: 'deleted-person', lastEmailId: 'email-1' }],
      new Map(),
    );
    expect(mutation).not.toHaveBeenCalled();
    expect(recompute).not.toHaveBeenCalled();
  });
});
