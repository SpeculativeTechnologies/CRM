import { type CoreApiClient } from 'twenty-client-sdk/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildPersonAggregates,
  buildPersonUpdateData,
  buildRelatedUpdateData,
  pickPersonLastContact,
} from 'src/utils/person-last-contact-aggregation';
import { recomputePersonLastContact } from 'src/utils/recompute-person-last-contact';
import { updatePersonForInteraction } from 'src/utils/update-person-last-contact';

const EARLIER = '2026-06-01T12:00:00.000Z';
const LATER = '2026-06-05T12:00:00.000Z';
const NOW = '2026-06-10T12:00:00.000Z';
const PERSON_ID = 'person-1';

type ContactLog = {
  id: string;
  personId: string | null;
  occurredAt: string | null;
  direction: string;
  createdBy?: { workspaceMemberId: string };
};
type Person = Record<string, string | null>;

const createClient = ({
  logs = [],
  emailAt,
  meetingAt,
}: { logs?: ContactLog[]; emailAt?: string; meetingAt?: string } = {}) => {
  const state: { person: Person; logs: ContactLog[] } = {
    person: { id: PERSON_ID, companyId: 'company-1', updatedAt: EARLIER },
    logs,
  };
  const mutation = vi.fn().mockImplementation(async (request) => {
    const update = request.updatePeople ?? request.updatePerson;
    if (update) {
      Object.assign(state.person, update.__args.data);
      return { updatePeople: [{ id: PERSON_ID }] };
    }
    return {};
  });
  const query = vi.fn().mockImplementation(async (request) => {
    if (request.person) {
      return { person: { ...state.person } };
    }
    if (request.people) {
      return {
        people: {
          edges: [
            {
              node: {
                lastContactAt: state.person.lastContactAt,
                lastContactItemContactLog: state.person
                  .lastContactItemContactLogId
                  ? { id: state.person.lastContactItemContactLogId }
                  : null,
                lastContactItemMessage: state.person.lastContactItemMessageId
                  ? { id: state.person.lastContactItemMessageId }
                  : null,
                lastContactItemCalendarEvent: state.person
                  .lastContactItemCalendarEventId
                  ? { id: state.person.lastContactItemCalendarEventId }
                  : null,
              },
            },
          ],
        },
      };
    }
    if (request.contactLogs) {
      return {
        contactLogs: {
          edges: state.logs.map((node) => ({ node })),
          pageInfo: { hasNextPage: false },
        },
      };
    }
    if (request.messageParticipants) {
      const members = Boolean(
        request.messageParticipants.__args.filter.workspaceMemberId,
      );
      const node = members
        ? { messageId: 'email-1', role: 'FROM', workspaceMemberId: 'member-1' }
        : {
            personId: PERSON_ID,
            message: { id: 'email-1', receivedAt: emailAt },
          };
      return {
        messageParticipants: {
          edges: emailAt ? [{ node }] : [],
          pageInfo: { hasNextPage: false },
        },
      };
    }
    if (request.calendarEventParticipants) {
      const members = Boolean(
        request.calendarEventParticipants.__args.filter.workspaceMemberId,
      );
      const node = members
        ? {
            calendarEventId: 'meeting-1',
            isOrganizer: true,
            workspaceMemberId: 'member-1',
          }
        : {
            personId: PERSON_ID,
            calendarEvent: {
              id: 'meeting-1',
              startsAt: meetingAt,
              isCanceled: false,
            },
          };
      return {
        calendarEventParticipants: {
          edges: meetingAt ? [{ node }] : [],
          pageInfo: { hasNextPage: false },
        },
      };
    }
    throw new Error('Unexpected query');
  });
  return {
    state,
    query,
    mutation,
    client: { query, mutation } as unknown as CoreApiClient,
  };
};

const log = (overrides: Partial<ContactLog> = {}): ContactLog => ({
  id: 'log-1',
  personId: PERSON_ID,
  occurredAt: LATER,
  direction: 'OUTBOUND',
  createdBy: { workspaceMemberId: 'member-2' },
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('manually logged contact', () => {
  it('should count logged contact without an email address or synced account', async () => {
    const { client, state, mutation } = createClient({ logs: [log()] });
    await recomputePersonLastContact(client, PERSON_ID);
    expect(state.person).toMatchObject({
      lastContactAt: LATER,
      lastOutboundAt: LATER,
      lastInboundAt: null,
      lastContactById: 'member-2',
      lastContactItemContactLogId: 'log-1',
      lastEmailId: null,
      lastMeetingId: null,
    });
    expect(
      mutation.mock.calls.find(([request]) => request.updateCompany)?.[0]
        .updateCompany.__args.data,
    ).toMatchObject({
      lastContactAt: LATER,
      lastContactItemContactLogId: 'log-1',
    });
    expect(
      mutation.mock.calls.find(([request]) => request.updateOpportunities)?.[0]
        .updateOpportunities.__args.data,
    ).toMatchObject({
      lastContactAt: LATER,
      lastContactItemContactLogId: 'log-1',
    });
  });

  it.each(['OUTBOUND', 'INBOUND', 'BOTH'])(
    'should apply the %s direction to the correct dates',
    async (direction) => {
      const { client, state } = createClient({ logs: [log({ direction })] });
      await recomputePersonLastContact(client, PERSON_ID);
      expect(state.person.lastOutboundAt).toBe(
        direction === 'INBOUND' ? null : LATER,
      );
      expect(state.person.lastInboundAt).toBe(
        direction === 'OUTBOUND' ? null : LATER,
      );
    },
  );

  it('should preserve a newer email when logging an older contact', async () => {
    const { client, state } = createClient({
      logs: [log({ occurredAt: EARLIER })],
      emailAt: LATER,
    });
    await recomputePersonLastContact(client, PERSON_ID);
    expect(state.person).toMatchObject({
      lastContactAt: LATER,
      lastContactItemMessageId: 'email-1',
      lastContactItemContactLogId: null,
    });
  });

  it('should fall back to a meeting when the latest contact log is deleted', async () => {
    const { client, state } = createClient({
      logs: [log()],
      meetingAt: EARLIER,
    });
    await recomputePersonLastContact(client, PERSON_ID);
    state.logs = [];
    await recomputePersonLastContact(client, PERSON_ID);
    expect(state.person).toMatchObject({
      lastContactAt: EARLIER,
      lastContactItemCalendarEventId: 'meeting-1',
      lastContactItemContactLogId: null,
      lastContactById: 'member-1',
    });
  });

  it('should clear all contact dates when the only contact log is removed and restore them when restored', async () => {
    const { client, state } = createClient({ logs: [log()] });
    await recomputePersonLastContact(client, PERSON_ID);
    state.logs = [];
    await recomputePersonLastContact(client, PERSON_ID);
    expect(state.person).toMatchObject({
      lastContactAt: null,
      lastOutboundAt: null,
      lastInboundAt: null,
      lastContactById: null,
      lastContactItemContactLogId: null,
    });
    state.logs = [log()];
    await recomputePersonLastContact(client, PERSON_ID);
    expect(state.person.lastContactAt).toBe(LATER);
  });

  it('should recalculate dates and direction when a contact log is corrected', async () => {
    const { client, state } = createClient({ logs: [log()] });
    await recomputePersonLastContact(client, PERSON_ID);
    state.logs = [log({ occurredAt: EARLIER, direction: 'INBOUND' })];
    await recomputePersonLastContact(client, PERSON_ID);
    expect(state.person).toMatchObject({
      lastContactAt: EARLIER,
      lastInboundAt: EARLIER,
      lastOutboundAt: null,
    });
  });

  it('should include manual contact in the same aggregate used by every backfill', async () => {
    const { client } = createClient({ logs: [log()], emailAt: EARLIER });
    const aggregate = (await buildPersonAggregates(client, [PERSON_ID])).get(
      PERSON_ID,
    );
    expect(buildPersonUpdateData(aggregate ?? {})).toMatchObject({
      lastContactAt: LATER,
      lastEmailId: 'email-1',
      lastContactItemContactLogId: 'log-1',
    });
    expect(
      buildRelatedUpdateData(pickPersonLastContact(aggregate)!),
    ).toMatchObject({
      lastContactAt: LATER,
      lastContactItemContactLogId: 'log-1',
      lastContactItemMessageId: null,
    });
  });

  it('should exclude future, invalid, incomplete, and unlinked contact logs', async () => {
    const { client, state } = createClient({
      logs: [
        log({ occurredAt: '2027-01-01T12:00:00Z' }),
        log({ occurredAt: 'invalid' }),
        log({ occurredAt: null }),
        log({ personId: null }),
        log({ direction: 'unknown' }),
      ],
    });
    await recomputePersonLastContact(client, PERSON_ID);
    expect(state.person.lastContactAt).toBeNull();
  });

  it('should compare timezone offsets as instants', async () => {
    const { client, state } = createClient({
      logs: [log({ occurredAt: '2026-06-05T09:00:00-04:00' })],
      emailAt: LATER,
    });
    await recomputePersonLastContact(client, PERSON_ID);
    expect(state.person.lastContactAt).toBe('2026-06-05T13:00:00.000Z');
  });

  it('should retry a correction when another interaction updates the person during aggregation', async () => {
    const { client, state, mutation } = createClient({ logs: [log()] });
    mutation.mockImplementationOnce(async () => {
      state.person.lastContactAt = LATER;
      state.logs = [log({ occurredAt: NOW })];
      return { updatePeople: [] };
    });
    await recomputePersonLastContact(client, PERSON_ID);
    const writes = mutation.mock.calls.filter(
      ([request]) => request.updatePeople,
    );
    expect(writes).toHaveLength(2);
    expect(writes[1][0].updatePeople.__args.filter.and).toContainEqual({
      lastContactAt: { eq: LATER },
    });
    expect(state.person.lastContactAt).toBe(NOW);
  });

  it('should retain a manual contact source when an older synced email arrives', async () => {
    const { client, state } = createClient({ logs: [log()] });
    await recomputePersonLastContact(client, PERSON_ID);
    await updatePersonForInteraction(client, {
      personId: PERSON_ID,
      occurredAt: EARLIER,
      itemId: 'email-2',
      kind: 'email',
      direction: 'outbound',
      workspaceMemberId: 'member-1',
    });
    expect(state.person).toMatchObject({
      lastContactAt: LATER,
      lastContactItemContactLogId: 'log-1',
      lastEmailId: 'email-2',
    });
  });

  it('should clear the manual contact source when a newer synced email wins', async () => {
    const { client, state } = createClient({ logs: [log()] });
    await recomputePersonLastContact(client, PERSON_ID);
    await updatePersonForInteraction(client, {
      personId: PERSON_ID,
      occurredAt: NOW,
      itemId: 'email-2',
      kind: 'email',
      direction: 'outbound',
      workspaceMemberId: 'member-1',
    });
    expect(state.person).toMatchObject({
      lastContactAt: NOW,
      lastContactItemContactLogId: null,
      lastContactItemMessageId: 'email-2',
    });
  });
});
