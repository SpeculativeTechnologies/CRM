import { useEffect, useState } from 'react';

import { isDefined } from 'twenty-shared/utils';

import { getLocalFirstDatabase } from '@/local-first/services/getLocalFirstDatabase';

export type LocalFirstPersonRecord = {
  id: string;
  nameFirstName: string | null;
  jobTitle: string | null;
};

// Debug-panel read of the local mirror. The table is created by the sync loop
// from the server's column list, so queries here fail until that has happened;
// failures are swallowed and retried rather than surfaced.
export const useLocalFirstPersonRecords = () => {
  const [records, setRecords] = useState<LocalFirstPersonRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const read = async () => {
      try {
        const pg = await getLocalFirstDatabase();

        // Soft-deleted rows are excluded to match what the API returns by
        // default; replication ships them, so filtering is on us.
        const rows = await pg.query<LocalFirstPersonRecord>(
          `select id, "nameFirstName", "jobTitle"
           from person where "deletedAt" is null
           order by "updatedAt" desc nulls last limit 5`,
        );
        const counted = await pg.query<{ count: number }>(
          'select count(*)::int as count from person where "deletedAt" is null',
        );

        if (!isMounted) return;

        setRecords(rows.rows);
        setTotalCount(counted.rows[0]?.count ?? 0);
      } catch {
        // Table not created yet, or the database is mid-migration.
      }
    };

    read();
    intervalId = setInterval(read, 3000);

    return () => {
      isMounted = false;
      if (isDefined(intervalId)) clearInterval(intervalId);
    };
  }, []);

  return { records, totalCount };
};
