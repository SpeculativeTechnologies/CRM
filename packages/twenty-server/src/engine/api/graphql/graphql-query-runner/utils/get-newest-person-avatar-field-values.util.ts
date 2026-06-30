import { type ObjectRecord } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { hasRecordFieldValue } from 'src/engine/api/graphql/graphql-query-runner/utils/has-record-field-value.util';

// The person avatar lives across two fields: avatarUrl (deprecated, still the image identifier)
// and avatarFile. They must stay consistent, so we always carry both from the same source record.
export const PERSON_AVATAR_FIELD_NAMES = ['avatarUrl', 'avatarFile'] as const;

// When merging people, the avatar comes from the most recently updated record that has one,
// regardless of which record was chosen as the merge priority.
export const getNewestPersonAvatarFieldValues = (
  recordsToMerge: ObjectRecord[],
): Partial<ObjectRecord> => {
  const recordsWithAvatar = recordsToMerge.filter((record) =>
    PERSON_AVATAR_FIELD_NAMES.some((fieldName) =>
      hasRecordFieldValue(record[fieldName]),
    ),
  );

  if (recordsWithAvatar.length === 0) {
    return {};
  }

  const newestRecordWithAvatar = recordsWithAvatar.reduce((newest, candidate) =>
    getUpdatedAtTime(candidate) > getUpdatedAtTime(newest) ? candidate : newest,
  );

  return Object.fromEntries(
    PERSON_AVATAR_FIELD_NAMES.map((fieldName) => [
      fieldName,
      newestRecordWithAvatar[fieldName] ?? null,
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
