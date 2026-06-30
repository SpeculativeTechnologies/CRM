import { type ObjectRecord } from 'twenty-shared/types';

import { getNewestPersonAvatarFieldValues } from 'src/engine/api/graphql/graphql-query-runner/utils/get-newest-person-avatar-field-values.util';

const buildPerson = (person: Partial<ObjectRecord>): ObjectRecord =>
  ({ id: 'unused', ...person }) as ObjectRecord;

describe('getNewestPersonAvatarFieldValues', () => {
  it('should take the avatar from the most recently updated record, overriding priority order', () => {
    const records = [
      buildPerson({
        id: '1',
        updatedAt: '2024-01-01T00:00:00.000Z',
        avatarUrl: 'older.png',
        avatarFile: [{ fullPath: 'older' }],
      }),
      buildPerson({
        id: '2',
        updatedAt: '2024-06-01T00:00:00.000Z',
        avatarUrl: 'newer.png',
        avatarFile: [{ fullPath: 'newer' }],
      }),
    ];

    const result = getNewestPersonAvatarFieldValues(records);

    expect(result).toEqual({
      avatarUrl: 'newer.png',
      avatarFile: [{ fullPath: 'newer' }],
    });
  });

  it('should ignore more recent records that have no avatar', () => {
    const records = [
      buildPerson({
        id: '1',
        updatedAt: '2024-01-01T00:00:00.000Z',
        avatarUrl: 'has-avatar.png',
        avatarFile: null,
      }),
      buildPerson({
        id: '2',
        updatedAt: '2024-06-01T00:00:00.000Z',
        avatarUrl: '',
        avatarFile: null,
      }),
    ];

    const result = getNewestPersonAvatarFieldValues(records);

    expect(result).toEqual({
      avatarUrl: 'has-avatar.png',
      avatarFile: null,
    });
  });

  it('should carry both avatar fields from the same source record even when one is empty', () => {
    const records = [
      buildPerson({
        id: '1',
        updatedAt: '2024-01-01T00:00:00.000Z',
        avatarUrl: 'old.png',
        avatarFile: [{ fullPath: 'old' }],
      }),
      buildPerson({
        id: '2',
        updatedAt: '2024-06-01T00:00:00.000Z',
        avatarUrl: null,
        avatarFile: [{ fullPath: 'new' }],
      }),
    ];

    const result = getNewestPersonAvatarFieldValues(records);

    expect(result).toEqual({
      avatarUrl: null,
      avatarFile: [{ fullPath: 'new' }],
    });
  });

  it('should return an empty object when no record has an avatar', () => {
    const records = [
      buildPerson({ id: '1', updatedAt: '2024-01-01T00:00:00.000Z' }),
      buildPerson({ id: '2', updatedAt: '2024-06-01T00:00:00.000Z' }),
    ];

    const result = getNewestPersonAvatarFieldValues(records);

    expect(result).toEqual({});
  });

  it('should treat a missing updatedAt as the oldest', () => {
    const records = [
      buildPerson({ id: '1', avatarUrl: 'no-timestamp.png' }),
      buildPerson({
        id: '2',
        updatedAt: '2024-06-01T00:00:00.000Z',
        avatarUrl: 'newer.png',
      }),
    ];

    const result = getNewestPersonAvatarFieldValues(records);

    expect(result.avatarUrl).toBe('newer.png');
  });
});
