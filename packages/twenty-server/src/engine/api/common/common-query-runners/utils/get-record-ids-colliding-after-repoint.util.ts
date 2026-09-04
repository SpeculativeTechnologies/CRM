import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { getValueFromPath } from 'src/engine/api/common/common-query-runners/common-create-many-query-runner/utils/get-value-from-path.util';

const compareByCreationThenId = (
  left: ObjectLiteral,
  right: ObjectLiteral,
): number => {
  const leftCreatedAt = String(left.createdAt ?? '');
  const rightCreatedAt = String(right.createdAt ?? '');

  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt < rightCreatedAt ? -1 : 1;
  }

  return String(left.id) < String(right.id) ? -1 : 1;
};

// A merge repoints every row that referenced an absorbed record onto the
// survivor. Rows that only differed by which duplicate they pointed at (the
// same message thread targeting both companies, say) then land on one unique
// key and the repoint fails. Keep one row per key: the survivor's when it has
// one, otherwise the oldest absorbed row, and report the rest for deletion.
// Postgres unique indexes never match on NULL, so rows with a null partner
// value cannot collide and are left alone.
export const getRecordIdsCollidingAfterRepoint = ({
  records,
  joinColumnName,
  partnerPaths,
  fromIds,
  toId,
}: {
  records: ObjectLiteral[];
  joinColumnName: string;
  partnerPaths: string[];
  fromIds: string[];
  toId: string;
}): string[] => {
  const fromIdSet = new Set(fromIds);
  const recordsByUniqueKey = new Map<string, ObjectLiteral[]>();

  for (const record of records) {
    const pointedRecordId = record[joinColumnName];

    if (pointedRecordId !== toId && !fromIdSet.has(pointedRecordId)) {
      continue;
    }

    const partnerValues = partnerPaths.map((path) =>
      getValueFromPath(record, path),
    );

    if (partnerValues.some((value) => !isDefined(value))) {
      continue;
    }

    const uniqueKey = JSON.stringify(partnerValues);
    const group = recordsByUniqueKey.get(uniqueKey) ?? [];

    group.push(record);
    recordsByUniqueKey.set(uniqueKey, group);
  }

  const recordIdsToDelete: string[] = [];

  for (const group of recordsByUniqueKey.values()) {
    const survivorHasRow = group.some(
      (record) => record[joinColumnName] === toId,
    );
    const absorbedRows = group
      .filter((record) => record[joinColumnName] !== toId)
      .sort(compareByCreationThenId);

    const redundantRows = survivorHasRow ? absorbedRows : absorbedRows.slice(1);

    recordIdsToDelete.push(...redundantRows.map((record) => record.id));
  }

  return recordIdsToDelete;
};
