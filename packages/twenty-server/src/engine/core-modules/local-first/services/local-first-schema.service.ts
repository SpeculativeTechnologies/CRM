import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';

import { LOCAL_FIRST_SYNCABLE_TABLES } from 'src/engine/core-modules/local-first/constants/local-first-syncable-tables.constant';

export type LocalFirstColumn = {
  name: string;
  dataType: string;
};

type CacheEntry = {
  columns: LocalFirstColumn[];
  expiresAt: number;
};

// Short enough that a newly added custom field starts syncing without a
// restart, long enough that the client's 3s poll does not re-introspect the
// schema on every request.
const SCHEMA_CACHE_TTL_MS = 60_000;

@Injectable()
export class LocalFirstSchemaService {
  private readonly columnCache = new Map<string, CacheEntry>();

  constructor(
    // The core connection is enough: information_schema is per-database and
    // workspace schemas share it, so this avoids needing a workspace context.
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  assertTableIsSyncable(tableName: string): void {
    if (!LOCAL_FIRST_SYNCABLE_TABLES.includes(tableName)) {
      throw new NotFoundException(
        `Table "${tableName}" is not available for local-first sync`,
      );
    }
  }

  async getSyncableColumns({
    workspaceSchema,
    tableName,
    now = Date.now(),
  }: {
    workspaceSchema: string;
    tableName: string;
    now?: number;
  }): Promise<LocalFirstColumn[]> {
    this.assertTableIsSyncable(tableName);

    const cacheKey = `${workspaceSchema}.${tableName}`;
    const cached = this.columnCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      return cached.columns;
    }

    const columns = await this.queryColumns({ workspaceSchema, tableName });

    if (columns.length === 0) {
      throw new NotFoundException(
        `Table "${tableName}" was not found in this workspace`,
      );
    }

    this.columnCache.set(cacheKey, {
      columns,
      expiresAt: now + SCHEMA_CACHE_TTL_MS,
    });

    return columns;
  }

  private async queryColumns({
    workspaceSchema,
    tableName,
  }: {
    workspaceSchema: string;
    tableName: string;
  }): Promise<LocalFirstColumn[]> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      // Generated columns (person.searchVector) cannot travel over logical
      // replication, and tsvector has no client-side equivalent, so both are
      // excluded rather than breaking the shape.
      const rows: { column_name: string; data_type: string }[] =
        await queryRunner.query(
          `SELECT column_name, data_type
           FROM information_schema.columns
           WHERE table_schema = $1
             AND table_name = $2
             AND is_generated = 'NEVER'
             AND data_type <> 'tsvector'
           ORDER BY ordinal_position`,
          [workspaceSchema, tableName],
        );

      return rows.map((row) => ({
        name: row.column_name,
        dataType: row.data_type,
      }));
    } finally {
      await queryRunner.release();
    }
  }
}
