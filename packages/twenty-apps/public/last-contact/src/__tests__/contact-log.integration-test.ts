import { CoreApiClient } from 'twenty-client-sdk/core';
import { afterEach, describe, expect, it } from 'vitest';

const client = new CoreApiClient();
const EARLIER = '2025-06-01T12:00:00.000Z';
const LATER = '2025-06-05T12:00:00.000Z';
const people: string[] = [];
const logs: string[] = [];

const createPerson = async () => {
  const { createPerson } = await client.mutation({
    createPerson: {
      __args: {
        data: { name: { firstName: 'Contact', lastName: 'Log Fixture' } },
      },
      id: true,
    },
  });
  const id = createPerson?.id;
  if (!id) throw new Error('Fixture person was not created');
  people.push(id);
  return id;
};

const waitForContact = async (
  personId: string,
  occurredAt: string | null,
  logId: string | null,
) => {
  await expect
    .poll(
      async () => {
        const { person } = await client.query({
          person: {
            __args: { filter: { id: { eq: personId } } },
            lastContactAt: true,
            lastContactItemContactLog: { id: true },
          },
        });
        return {
          at: person?.lastContactAt
            ? new Date(person.lastContactAt).toISOString()
            : null,
          log: person?.lastContactItemContactLog?.id ?? null,
        };
      },
      { timeout: 30_000, interval: 500 },
    )
    .toEqual({ at: occurredAt, log: logId });
};

afterEach(async () => {
  for (const id of logs.splice(0)) {
    await client.mutation({ deleteContactLog: { __args: { id }, id: true } });
  }
  for (const id of people.splice(0)) {
    await client.mutation({ deletePerson: { __args: { id }, id: true } });
  }
});

describe('contact log database events', () => {
  it('should update last contact through the installed app on create, correction, reassignment, delete, and restore', async () => {
    const firstPerson = await createPerson();
    const secondPerson = await createPerson();
    const { createContactLog } = await client.mutation({
      createContactLog: {
        __args: {
          data: {
            name: 'Text fixture',
            personId: firstPerson,
            channel: 'TEXT',
            direction: 'OUTBOUND',
            occurredAt: LATER,
            notes: 'Synthetic contact log.',
          },
        },
        id: true,
      },
    });
    const id = createContactLog?.id;
    if (!id) throw new Error('Fixture contact log was not created');
    logs.push(id);
    await waitForContact(firstPerson, LATER, id);

    await client.mutation({
      updateContactLog: {
        __args: { id, data: { occurredAt: EARLIER } },
        id: true,
      },
    });
    await waitForContact(firstPerson, EARLIER, id);

    await client.mutation({
      updateContactLog: {
        __args: { id, data: { personId: secondPerson } },
        id: true,
      },
    });
    await waitForContact(firstPerson, null, null);
    await waitForContact(secondPerson, EARLIER, id);

    await client.mutation({ deleteContactLog: { __args: { id }, id: true } });
    await waitForContact(secondPerson, null, null);

    await client.mutation({ restoreContactLog: { __args: { id }, id: true } });
    await waitForContact(secondPerson, EARLIER, id);
  });
});
