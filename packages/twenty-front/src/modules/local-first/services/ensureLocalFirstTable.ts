import { type PGliteInterface } from '@electric-sql/pglite';

import { type LocalFirstColumn } from '@/local-first/services/getLocalFirstDatabase';
import { quoteLocalIdentifier } from '@/local-first/utils/quoteLocalIdentifier';
import { toLocalColumnDefinition } from '@/local-first/utils/toLocalColumnDefinition';

export const ensureLocalFirstTable = async ({
  pg,
  tableName,
  columns,
}: {
  pg: Pick<PGliteInterface, 'exec'>;
  tableName: string;
  columns: LocalFirstColumn[];
}) => {
  const columnDefinitions = columns
    .map((column) =>
      toLocalColumnDefinition({
        ...column,
        isPrimaryKey: column.name === 'id',
      }),
    )
    .join(', ');

  await pg.exec(
    `create table if not exists ${quoteLocalIdentifier(tableName)} (${columnDefinitions})`,
  );

  const columnNames = new Set(columns.map((column) => column.name));
  const indexedColumnSets = [
    ['deletedAt', 'position'],
    ...[...columnNames]
      .filter((column) => column !== 'id' && column.endsWith('Id'))
      .map((column) => [column]),
  ];

  for (const indexedColumns of indexedColumnSets) {
    if (!indexedColumns.every((column) => columnNames.has(column))) continue;

    await pg.exec(
      `create index if not exists ${quoteLocalIdentifier(`${tableName}_${indexedColumns.join('_')}_idx`)}
       on ${quoteLocalIdentifier(tableName)} (${indexedColumns.map(quoteLocalIdentifier).join(', ')})`,
    );
  }
};
