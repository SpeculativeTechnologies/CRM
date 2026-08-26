export type LocalFirstComparisonResult = {
  isMatch: boolean;
  serverCount: number;
  localCount: number;
  comparedFieldCount: number;
  // Human-readable divergences, capped so one bad query can't flood the log.
  differences: string[];
};

const MAX_REPORTED_DIFFERENCES = 5;

// Local column -> path in the GraphQL node. The API exposes composite fields
// as nested objects (name.firstName) while the synced table is flat
// (nameFirstName), so comparing by column name alone reports every row as
// divergent.
//
// Only displayed data is compared. position/createdAt/updatedAt/deletedAt are
// excluded: the server serialises timestamps differently and position is a
// float, so comparing them would report formatting as divergence. Ordering
// already proves position agrees, and the row set proves deletedAt does.
const COMPARED_FIELD_PATHS: Record<string, readonly string[]> = {
  nameFirstName: ['name', 'firstName'],
  nameLastName: ['name', 'lastName'],
  jobTitle: ['jobTitle'],
  emailsPrimaryEmail: ['emails', 'primaryEmail'],
};

const NOT_REQUESTED = Symbol('notRequested');

// Walks the path, distinguishing "the query did not ask for this field" from
// "the field is null". A field the current view does not select is absent from
// the response and must not count as a divergence.
const readServerValue = (
  record: Record<string, unknown>,
  path: readonly string[],
): unknown | typeof NOT_REQUESTED => {
  let current: unknown = record;

  for (const key of path) {
    if (typeof current !== 'object' || current === null) {
      return NOT_REQUESTED;
    }

    if (!(key in current)) {
      return NOT_REQUESTED;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
};

const normalizeValue = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);

// Compares what the server returned for a FindManyPeople query against what
// the local database returned for the translated query. Order matters: a local
// read that returns the right set in the wrong order is still wrong for a
// paginated table.
export const compareLocalAndServerPeople = ({
  serverRecords,
  localRecords,
}: {
  serverRecords: Record<string, unknown>[];
  localRecords: Record<string, unknown>[];
}): LocalFirstComparisonResult => {
  const differences: string[] = [];
  let comparedFieldCount = 0;

  const addDifference = (difference: string) => {
    if (differences.length < MAX_REPORTED_DIFFERENCES) {
      differences.push(difference);
    }
  };

  if (serverRecords.length !== localRecords.length) {
    addDifference(
      `row count: server ${serverRecords.length}, local ${localRecords.length}`,
    );
  }

  const comparedLength = Math.min(serverRecords.length, localRecords.length);

  for (let index = 0; index < comparedLength; index++) {
    const serverRecord = serverRecords[index];
    const localRecord = localRecords[index];

    if (serverRecord.id !== localRecord.id) {
      addDifference(
        `position ${index}: server id ${String(serverRecord.id)}, local id ${String(localRecord.id)}`,
      );
      continue;
    }

    for (const [column, path] of Object.entries(COMPARED_FIELD_PATHS)) {
      const serverValue = readServerValue(serverRecord, path);

      if (serverValue === NOT_REQUESTED) continue;

      comparedFieldCount += 1;

      const normalizedServerValue = normalizeValue(serverValue);
      const normalizedLocalValue = normalizeValue(localRecord[column]);

      if (normalizedServerValue !== normalizedLocalValue) {
        addDifference(
          `${String(serverRecord.id)}.${column}: server "${normalizedServerValue}", local "${normalizedLocalValue}"`,
        );
      }
    }
  }

  return {
    isMatch: differences.length === 0,
    serverCount: serverRecords.length,
    localCount: localRecords.length,
    comparedFieldCount,
    differences,
  };
};
