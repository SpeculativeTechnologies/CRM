import { type ObjectRecord } from 'twenty-shared/types';

import { getNewestPersonAvatarFieldValues } from 'src/engine/api/graphql/graphql-query-runner/utils/get-newest-person-avatar-field-values.util';

const buildPerson = (person: Partial<ObjectRecord>): ObjectRecord =>
  ({ id: 'unused', ...person }) as ObjectRecord;

const avatarFile = (fileId: string) => [{ fileId, label: 'photo.jpg' }];

describe('getNewestPersonAvatarFieldValues', () => {
  it('should take the avatar image from the most recently updated record, overriding priority order', () => {
    const records = [
      buildPerson({
        id: '1',
        updatedAt: '2024-01-01T00:00:00.000Z',
        avatarFile: avatarFile('older'),
      }),
      buildPerson({
        id: '2',
        updatedAt: '2024-06-01T00:00:00.000Z',
        avatarFile: avatarFile('newer'),
      }),
    ];

    const result = getNewestPersonAvatarFieldValues(records);

    expect(result.avatarFile).toEqual(avatarFile('newer'));
  });

  it('should keep an older real image over a newer record that only has a placeholder', () => {
    const records = [
      buildPerson({
        id: '1',
        updatedAt: '2024-01-01T00:00:00.000Z',
        avatarFile: avatarFile('real'),
      }),
      buildPerson({
        id: '2',
        updatedAt: '2024-06-01T00:00:00.000Z',
        avatarFile: null,
      }),
    ];

    const result = getNewestPersonAvatarFieldValues(records);

    expect(result.avatarFile).toEqual(avatarFile('real'));
  });

  it('should ignore avatarUrl: a newer avatarUrl-only record does not beat an older real image', () => {
    const records = [
      buildPerson({
        id: '1',
        updatedAt: '2024-01-01T00:00:00.000Z',
        avatarUrl: null,
        avatarFile: avatarFile('real'),
      }),
      buildPerson({
        id: '2',
        updatedAt: '2024-06-01T00:00:00.000Z',
        avatarUrl: 'https://example.com/placeholder-image.png',
        avatarFile: null,
      }),
    ];

    const result = getNewestPersonAvatarFieldValues(records);

    expect(result.avatarFile).toEqual(avatarFile('real'));
    expect(result.avatarUrl).toBeNull();
  });

  it('should not treat an avatarFile entry without a file as a real image', () => {
    const records = [
      buildPerson({
        id: '1',
        updatedAt: '2024-01-01T00:00:00.000Z',
        avatarFile: [{ label: 'no-file.jpg' }],
      }),
      buildPerson({
        id: '2',
        updatedAt: '2024-06-01T00:00:00.000Z',
      }),
    ];

    expect(getNewestPersonAvatarFieldValues(records)).toEqual({});
  });

  it('should return an empty object when no record has a real avatar image', () => {
    const records = [
      buildPerson({
        id: '1',
        updatedAt: '2024-01-01T00:00:00.000Z',
        avatarUrl: 'https://example.com/placeholder.png',
        avatarFile: null,
      }),
      buildPerson({ id: '2', updatedAt: '2024-06-01T00:00:00.000Z' }),
    ];

    expect(getNewestPersonAvatarFieldValues(records)).toEqual({});
  });

  it('should treat a missing updatedAt as the oldest', () => {
    const records = [
      buildPerson({ id: '1', avatarFile: avatarFile('no-timestamp') }),
      buildPerson({
        id: '2',
        updatedAt: '2024-06-01T00:00:00.000Z',
        avatarFile: avatarFile('newer'),
      }),
    ];

    expect(getNewestPersonAvatarFieldValues(records).avatarFile).toEqual(
      avatarFile('newer'),
    );
  });
});
