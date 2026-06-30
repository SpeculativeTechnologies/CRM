import { isNonEmptyString } from '@sniptt/guards';
import { type ObjectRecord } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

// The person avatar lives across two fields, but only avatarFile is rendered (see getAvatarUrl
// on the frontend, which returns avatarFile[0].url for people); avatarUrl is deprecated. We still
// carry both from the same source record so the merged record stays internally consistent.
export const PERSON_AVATAR_FIELD_NAMES = ['avatarUrl', 'avatarFile'] as const;

// A person shows placeholder initials unless avatarFile holds an actual file, so that is what
// distinguishes a real image from a placeholder. avatarUrl is ignored on purpose: a record with
// only avatarUrl set still renders as a placeholder.
const hasDisplayableAvatarImage = (record: ObjectRecord): boolean => {
  const avatarFile = record.avatarFile;

  if (!Array.isArray(avatarFile) || avatarFile.length === 0) {
    return false;
  }

  const firstFile = avatarFile[0];

  return (
    isDefined(firstFile) &&
    (isNonEmptyString(firstFile.fileId) || isNonEmptyString(firstFile.url))
  );
};

// When merging people, keep the avatar from the most recently updated record that has an actual
// image, regardless of which record was chosen as the merge priority. Records showing only
// placeholder initials are ignored, so an older real photo always wins over a newer placeholder.
export const getNewestPersonAvatarFieldValues = (
  recordsToMerge: ObjectRecord[],
): Partial<ObjectRecord> => {
  const recordsWithAvatarImage = recordsToMerge.filter(
    hasDisplayableAvatarImage,
  );

  if (recordsWithAvatarImage.length === 0) {
    return {};
  }

  const newestRecordWithAvatarImage = recordsWithAvatarImage.reduce(
    (newest, candidate) =>
      getUpdatedAtTime(candidate) > getUpdatedAtTime(newest)
        ? candidate
        : newest,
  );

  return Object.fromEntries(
    PERSON_AVATAR_FIELD_NAMES.map((fieldName) => [
      fieldName,
      newestRecordWithAvatarImage[fieldName] ?? null,
    ]),
  );
};

const getUpdatedAtTime = (record: ObjectRecord): number => {
  if (!isDefined(record.updatedAt)) {
    return 0;
  }

  const time = new Date(record.updatedAt).getTime();

  return Number.isNaN(time) ? 0 : time;
};
