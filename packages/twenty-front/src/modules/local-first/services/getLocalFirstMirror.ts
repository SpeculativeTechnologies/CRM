import { type PGlite } from '@electric-sql/pglite';
import { ApiPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { LOCAL_FIRST_MIRRORED_TABLES } from '@/local-first/constants/LOCAL_FIRST_MIRRORED_TABLES';
import {
  ensureLocalFirstTable,
  type LocalFirstColumn,
} from '@/local-first/services/getLocalFirstDatabase';
import { getLocalFirstAuthHeaders } from '@/local-first/utils/getLocalFirstAuthHeaders';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type LocalFirstMirror = {
  pg: PGlite;
  // Columns per mirrored table, with their source types: writes need the type
  // to cast incoming values, reads only need the names. A table absent from
  // this map is not mirrored, so nothing may be read from it.
  tables: Record<string, LocalFirstColumn[]>;
  columnsByTable: Record<string, string[]>;
};

let mirrorPromise: Promise<LocalFirstMirror> | null = null;
let resolvedMirror: LocalFirstMirror | null = null;

const fetchTableColumns = async (
  tableName: string,
): Promise<LocalFirstColumn[] | null> => {
  const response = await fetch(
    `${REACT_APP_SERVER_BASE_URL}/${ApiPath.LocalFirst}/schema/${tableName}`,
    {
      credentials: 'include',
      headers: getLocalFirstAuthHeaders(),
    },
  );

  // This workspace does not have the table (or it is not syncable): skip it
  // rather than failing the whole mirror.
  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(
      `Local-first schema for ${tableName} responded ${response.status}`,
    );
  }

  const { columns } = (await response.json()) as {
    columns: LocalFirstColumn[];
  };

  return columns;
};

const createMirror = async (): Promise<LocalFirstMirror> => {
  const schemas = await Promise.all(
    LOCAL_FIRST_MIRRORED_TABLES.map(async (tableName) => ({
      tableName,
      columns: await fetchTableColumns(tableName),
    })),
  );

  const tables: Record<string, LocalFirstColumn[]> = {};
  const columnsByTable: Record<string, string[]> = {};
  let pg: PGlite | null = null;

  for (const { tableName, columns } of schemas) {
    if (!isDefined(columns)) continue;

    pg = await ensureLocalFirstTable({ tableName, columns });
    tables[tableName] = columns;
    columnsByTable[tableName] = columns.map((column) => column.name);
  }

  if (!isDefined(pg)) {
    throw new Error('No local-first tables are available in this workspace');
  }

  return { pg, tables, columnsByTable };
};

// The local mirror as a single shared promise, so the sync loops and any
// reader converge on one PGlite instance and one schema view instead of
// racing. Everything that touches local data awaits this rather than reading
// state that may not be populated yet.
// The mirror if it is already built, or null. Reads use this rather than
// awaiting: booting PGlite and fetching schemas takes seconds on a cold page,
// and making a user wait on local infrastructure is strictly worse than going
// to the network. Local serving is opportunistic by design.
export const tryGetReadyLocalFirstMirror = (): LocalFirstMirror | null =>
  resolvedMirror;

export const getLocalFirstMirror = () => {
  if (!isDefined(mirrorPromise)) {
    mirrorPromise = createMirror()
      .then((mirror) => {
        resolvedMirror = mirror;

        return mirror;
      })
      .catch((error) => {
        // A failed setup must not be cached, or one early failure (e.g. a
        // request before auth is ready) would disable local reads for the tab.
        mirrorPromise = null;
        throw error;
      });
  }

  return mirrorPromise;
};
