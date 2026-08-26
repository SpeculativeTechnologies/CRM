import { type PGlite } from '@electric-sql/pglite';
import { ApiPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import {
  ensureLocalFirstTable,
  type LocalFirstColumn,
} from '@/local-first/services/getLocalFirstDatabase';
import { getLocalFirstAuthHeaders } from '@/local-first/utils/getLocalFirstAuthHeaders';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const LOCAL_FIRST_PERSON_TABLE = 'person';

export type LocalFirstPersonMirror = {
  pg: PGlite;
  columnNames: string[];
};

let mirrorPromise: Promise<LocalFirstPersonMirror> | null = null;

const createMirror = async (): Promise<LocalFirstPersonMirror> => {
  const response = await fetch(
    `${REACT_APP_SERVER_BASE_URL}/${ApiPath.LocalFirst}/schema/${LOCAL_FIRST_PERSON_TABLE}`,
    {
      credentials: 'include',
      headers: getLocalFirstAuthHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(`Local-first schema responded ${response.status}`);
  }

  const { columns } = (await response.json()) as {
    columns: LocalFirstColumn[];
  };

  const pg = await ensureLocalFirstTable({
    tableName: LOCAL_FIRST_PERSON_TABLE,
    columns,
  });

  return { pg, columnNames: columns.map((column) => column.name) };
};

// The local mirror as a single shared promise, so the sync loop and any reader
// converge on one PGlite instance and one column list instead of racing.
// Everything that touches local data awaits this rather than reading state
// that may not be populated yet.
export const getLocalFirstPersonMirror = () => {
  if (!isDefined(mirrorPromise)) {
    mirrorPromise = createMirror().catch((error) => {
      // A failed setup must not be cached, or one early failure (e.g. a
      // request before auth is ready) would disable local reads for the tab.
      mirrorPromise = null;
      throw error;
    });
  }

  return mirrorPromise;
};
