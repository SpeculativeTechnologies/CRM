import { type PersonDuplicatePairDecisionEntity } from 'src/engine/core-modules/person-duplicate-review/entities/person-duplicate-pair-decision.entity';
import {
  buildPersonDuplicateGroups,
  buildPersonDuplicatePairs,
  getPersonDuplicateIdentity,
} from 'src/engine/core-modules/person-duplicate-review/utils/person-duplicate-review.util';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

const makePerson = ({
  id,
  firstName = '',
  lastName = '',
  emails = [],
  phone = '',
  linkedinUrl = '',
  createdAt = '2026-01-01T00:00:00.000Z',
}: {
  id: string;
  firstName?: string;
  lastName?: string;
  emails?: string[];
  phone?: string;
  linkedinUrl?: string;
  createdAt?: string;
}): PersonWorkspaceEntity =>
  ({
    id,
    name: {
      firstName,
      lastName,
    },
    emails: {
      primaryEmail: emails[0] ?? '',
      additionalEmails: emails.slice(1),
    },
    phones: {
      primaryPhoneNumber: phone,
      primaryPhoneCountryCode: 'US',
      primaryPhoneCallingCode: '+1',
      additionalPhones: [],
    },
    linkedinLink: {
      primaryLinkLabel: 'LinkedIn',
      primaryLinkUrl: linkedinUrl,
      secondaryLinks: [],
    },
    createdAt,
    updatedAt: createdAt,
  }) as unknown as PersonWorkspaceEntity;

describe('person duplicate review utilities', () => {
  it('matches exact normalized full names but not fuzzy names', () => {
    const exactFirstPerson = makePerson({
      id: '11111111-1111-1111-1111-111111111111',
      firstName: '  Avery ',
      lastName: 'Stone',
    });
    const exactSecondPerson = makePerson({
      id: '22222222-2222-2222-2222-222222222222',
      firstName: 'avery',
      lastName: 'STONE',
    });
    const fuzzyPerson = makePerson({
      id: '33333333-3333-3333-3333-333333333333',
      firstName: 'Averi',
      lastName: 'Stone',
    });

    const { pairs } = buildPersonDuplicatePairs([
      exactFirstPerson,
      exactSecondPerson,
      fuzzyPerson,
    ]);

    expect(pairs).toEqual([
      expect.objectContaining({
        leftPersonId: exactFirstPerson.id,
        rightPersonId: exactSecondPerson.id,
        reasons: ['NAME'],
      }),
    ]);
  });

  it('matches any email, phone, or LinkedIn URL on the records', () => {
    const firstPerson = makePerson({
      id: '11111111-1111-1111-1111-111111111111',
      emails: ['first@example.com', 'shared@example.com'],
      phone: '(212) 555-0100',
      linkedinUrl: 'https://www.linkedin.com/in/avery-stone/?trk=crm',
    });
    const secondPerson = makePerson({
      id: '22222222-2222-2222-2222-222222222222',
      emails: ['SHARED@example.com'],
      phone: '212-555-0100',
      linkedinUrl: 'linkedin.com/in/avery-stone',
    });

    const { pairs } = buildPersonDuplicatePairs([firstPerson, secondPerson]);

    expect(pairs).toEqual([
      expect.objectContaining({
        reasons: expect.arrayContaining(['EMAIL', 'PHONE', 'LINKEDIN']),
      }),
    ]);
  });

  it('keeps a dismissed pair hidden until either identity changes', () => {
    const firstPerson = makePerson({
      id: '11111111-1111-1111-1111-111111111111',
      firstName: 'Avery',
      lastName: 'Stone',
    });
    const secondPerson = makePerson({
      id: '22222222-2222-2222-2222-222222222222',
      firstName: 'Avery',
      lastName: 'Stone',
    });
    const decision = {
      leftPersonId: firstPerson.id,
      rightPersonId: secondPerson.id,
      leftFingerprint: getPersonDuplicateIdentity(firstPerson).fingerprint,
      rightFingerprint: getPersonDuplicateIdentity(secondPerson).fingerprint,
    } as PersonDuplicatePairDecisionEntity;

    expect(
      buildPersonDuplicateGroups({
        people: [firstPerson, secondPerson],
        decisions: [decision],
      }),
    ).toHaveLength(0);

    secondPerson.emails = {
      primaryEmail: 'new@example.com',
      additionalEmails: [],
    };

    expect(
      buildPersonDuplicateGroups({
        people: [firstPerson, secondPerson],
        decisions: [decision],
      }),
    ).toHaveLength(1);
  });

  it('groups connected duplicate pairs and orders stronger evidence first', () => {
    const strongFirstPerson = makePerson({
      id: '11111111-1111-1111-1111-111111111111',
      firstName: 'Avery',
      lastName: 'Stone',
      emails: ['shared@example.com'],
    });
    const strongSecondPerson = makePerson({
      id: '22222222-2222-2222-2222-222222222222',
      firstName: 'Avery',
      lastName: 'Stone',
      emails: ['shared@example.com'],
    });
    const weakFirstPerson = makePerson({
      id: '33333333-3333-3333-3333-333333333333',
      firstName: 'Morgan',
      lastName: 'Lee',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    const weakSecondPerson = makePerson({
      id: '44444444-4444-4444-4444-444444444444',
      firstName: 'Morgan',
      lastName: 'Lee',
      createdAt: '2025-01-02T00:00:00.000Z',
    });

    const groups = buildPersonDuplicateGroups({
      people: [
        weakFirstPerson,
        weakSecondPerson,
        strongFirstPerson,
        strongSecondPerson,
      ],
      decisions: [],
    });

    expect(groups).toHaveLength(2);
    expect(groups[0].reasons).toEqual(
      expect.arrayContaining(['NAME', 'EMAIL']),
    );
    expect(groups[1].reasons).toEqual(['NAME']);
  });

  it('merges reasons across a transitive chain into one group', () => {
    const chainStartPerson = makePerson({
      id: '55555555-5555-5555-5555-555555555555',
      firstName: 'Jordan',
      lastName: 'Reed',
      emails: ['jordan@example.com'],
    });
    const chainMiddlePerson = makePerson({
      id: '66666666-6666-6666-6666-666666666666',
      firstName: 'Jordy',
      lastName: 'Reed',
      emails: ['jordan@example.com'],
      phone: '5551112222',
    });
    const chainEndPerson = makePerson({
      id: '77777777-7777-7777-7777-777777777777',
      firstName: 'J',
      lastName: 'Reed',
      phone: '5551112222',
      linkedinUrl: 'https://linkedin.com/in/jordan-reed',
    });
    const unrelatedPerson = makePerson({
      id: '88888888-8888-8888-8888-888888888888',
      firstName: 'Casey',
      lastName: 'Woods',
    });

    const groups = buildPersonDuplicateGroups({
      people: [
        chainEndPerson,
        unrelatedPerson,
        chainStartPerson,
        chainMiddlePerson,
      ],
      decisions: [],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].people.map(({ id }) => id).sort()).toEqual([
      '55555555-5555-5555-5555-555555555555',
      '66666666-6666-6666-6666-666666666666',
      '77777777-7777-7777-7777-777777777777',
    ]);
    expect(groups[0].reasons).toEqual(['EMAIL', 'PHONE']);
  });
});
