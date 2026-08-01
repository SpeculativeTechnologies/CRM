import { useEffect, useState } from 'react';

import { getLocalFirstDatabase } from '@/local-first/services/getLocalFirstDatabase';

export type LocalFirstPersonRecord = {
  id: string;
  nameFirstName: string | null;
  nameLastName: string | null;
  jobTitle: string | null;
  city: string | null;
  updatedAt: string | null;
};

export const useLocalFirstPersonRecords = () => {
  const [records, setRecords] = useState<LocalFirstPersonRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const unsubscribeFns: Array<() => Promise<void>> = [];

    const setup = async () => {
      const pg = await getLocalFirstDatabase();

      const rowsLiveQuery = await pg.live.query<LocalFirstPersonRecord>(
        `select id, "nameFirstName", "nameLastName", "jobTitle", city, "updatedAt"
         from person order by "updatedAt" desc nulls last limit 25`,
        [],
        (results) => {
          if (isMounted) setRecords(results.rows);
        },
      );
      const countLiveQuery = await pg.live.query<{ count: number }>(
        'select count(*)::int as count from person',
        [],
        (results) => {
          if (isMounted) setTotalCount(results.rows[0]?.count ?? 0);
        },
      );

      if (!isMounted) {
        await rowsLiveQuery.unsubscribe();
        await countLiveQuery.unsubscribe();
        return;
      }

      setRecords(rowsLiveQuery.initialResults.rows);
      setTotalCount(countLiveQuery.initialResults.rows[0]?.count ?? 0);
      unsubscribeFns.push(
        rowsLiveQuery.unsubscribe,
        countLiveQuery.unsubscribe,
      );
    };

    setup();

    return () => {
      isMounted = false;
      unsubscribeFns.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  return { records, totalCount };
};
