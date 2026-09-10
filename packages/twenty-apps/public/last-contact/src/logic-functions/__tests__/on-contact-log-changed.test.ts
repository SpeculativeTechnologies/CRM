import { beforeEach, describe, expect, it, vi } from 'vitest';

const { recompute } = vi.hoisted(() => ({ recompute: vi.fn() }));
vi.mock('twenty-client-sdk/core', () => ({
  CoreApiClient: vi.fn(function () {
    return {};
  }),
}));
vi.mock('src/utils/recompute-person-last-contact', () => ({
  recomputePersonLastContact: recompute,
}));

import definition, {
  onContactLogChanged,
} from 'src/logic-functions/on-contact-log-changed';

beforeEach(() => {
  vi.clearAllMocks();
});

const event = (
  name: string,
  before?: { personId: string },
  after?: { personId: string },
) =>
  ({ name, recordId: 'log-1', properties: { before, after } }) as Parameters<
    typeof onContactLogChanged
  >[0];

describe('contact log events', () => {
  it('should listen for creation, editing, deletion, destruction, and restoration', () => {
    expect(definition.success).toBe(true);
    expect(definition.config.databaseEventTriggerSettings).toEqual({
      eventName: 'contactLog.*',
    });
  });
  it.each(['created', 'restored'])(
    'should recompute the person when a contact log is %s',
    async (action) => {
      await onContactLogChanged(
        event(`contactLog.${action}`, undefined, { personId: 'new-person' }),
      );
      expect(recompute).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        'new-person',
      );
    },
  );
  it.each(['deleted', 'destroyed'])(
    'should recompute the former person when a contact log is %s',
    async (action) => {
      await onContactLogChanged(
        event(`contactLog.${action}`, { personId: 'old-person' }),
      );
      expect(recompute).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        'old-person',
      );
    },
  );
  it('should repair both people when a log is reassigned', async () => {
    await onContactLogChanged(
      event(
        'contactLog.updated',
        { personId: 'old-person' },
        { personId: 'new-person' },
      ),
    );
    expect(recompute.mock.calls.map((call) => call[1])).toEqual([
      'old-person',
      'new-person',
    ]);
  });
  it('should recompute a person only once for a date correction', async () => {
    await onContactLogChanged(
      event(
        'contactLog.updated',
        { personId: 'person' },
        { personId: 'person' },
      ),
    );
    expect(recompute).toHaveBeenCalledTimes(1);
  });
  it('should not recompute for notes-only edits or logs without a person', async () => {
    const notesEvent = event(
      'contactLog.updated',
      { personId: 'person' },
      { personId: 'person' },
    );
    notesEvent.properties.updatedFields = ['notes'];
    await onContactLogChanged(notesEvent);
    await onContactLogChanged(event('contactLog.created'));
    expect(recompute).not.toHaveBeenCalled();
  });
});
