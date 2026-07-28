import { CALENDAR_EVENT_DATA_SEED_IDS } from 'src/engine/workspace-manager/dev-seeder/data/constants/calendar-event-data-seeds.constant';
import { getCalendarEventParticipantDataSeeds } from 'src/engine/workspace-manager/dev-seeder/data/constants/calendar-event-participant-data-seeds.constant';
import { MESSAGE_DATA_SEED_IDS } from 'src/engine/workspace-manager/dev-seeder/data/constants/message-data-seeds.constant';
import { getMessageParticipantDataSeeds } from 'src/engine/workspace-manager/dev-seeder/data/constants/message-participant-data-seeds.constant';
import { PERSON_DATA_SEED_IDS } from 'src/engine/workspace-manager/dev-seeder/data/constants/person-data-seeds.constant';
import { getWorkspaceMemberDataSeeds } from 'src/engine/workspace-manager/dev-seeder/data/constants/workspace-member-data-seeds.constant';

const WORKSPACE_ID = '20202020-1c25-4d02-bf25-6aeccf7ea419';
const LIGHT_SEED_RECORD_LIMIT = 5;

describe('light participant data seeds', () => {
  const lightPersonIds = new Set(
    Object.values(PERSON_DATA_SEED_IDS).slice(0, LIGHT_SEED_RECORD_LIMIT),
  );
  const lightWorkspaceMemberIds = new Set(
    getWorkspaceMemberDataSeeds(WORKSPACE_ID)
      .slice(0, LIGHT_SEED_RECORD_LIMIT)
      .map(({ id }) => id),
  );

  it('only references calendar events, people, and members in the light fixture', () => {
    const lightEventIds = new Set(
      Object.values(CALENDAR_EVENT_DATA_SEED_IDS).slice(
        0,
        LIGHT_SEED_RECORD_LIMIT,
      ),
    );
    const seeds = getCalendarEventParticipantDataSeeds(WORKSPACE_ID, true);

    expect(seeds.length).toBeGreaterThan(0);
    for (const seed of seeds) {
      expect(lightEventIds).toContain(seed.calendarEventId);
      if (seed.personId !== null) {
        expect(lightPersonIds).toContain(seed.personId);
      }
      if (seed.workspaceMemberId !== null) {
        expect(lightWorkspaceMemberIds).toContain(seed.workspaceMemberId);
      }
    }
  });

  it('only references messages, people, and members in the light fixture', () => {
    const lightMessageIds = new Set(
      Object.values(MESSAGE_DATA_SEED_IDS).slice(0, LIGHT_SEED_RECORD_LIMIT),
    );
    const seeds = getMessageParticipantDataSeeds(WORKSPACE_ID, true);

    expect(seeds.length).toBeGreaterThan(0);
    for (const seed of seeds) {
      expect(lightMessageIds).toContain(seed.messageId);
      expect(lightPersonIds).toContain(seed.personId);
      expect(lightWorkspaceMemberIds).toContain(seed.workspaceMemberId);
    }
  });
});
