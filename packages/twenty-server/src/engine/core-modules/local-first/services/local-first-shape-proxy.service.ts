import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type Response } from 'express';
import { isDefined } from 'twenty-shared/utils';

import { LOCAL_FIRST_SYNCED_TABLES } from 'src/engine/core-modules/local-first/constants/local-first-synced-tables.constant';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

// Electric drives shape pagination/liveness through these; the client may set
// them freely. Everything else (table, columns, where) is decided server-side
// so a device can only read whitelisted columns of its own workspace's tables.
const FORWARDED_QUERY_PARAMS = ['offset', 'handle', 'live', 'cursor'] as const;

const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'electric-handle',
  'electric-offset',
  'electric-schema',
  'electric-cursor',
  'electric-up-to-date',
] as const;

@Injectable()
export class LocalFirstShapeProxyService {
  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  async proxyShapeRequest({
    tableName,
    workspaceSchema,
    query,
    response,
  }: {
    tableName: string;
    workspaceSchema: string;
    query: Record<string, string | undefined>;
    response: Response;
  }): Promise<void> {
    const electricUrl = this.twentyConfigService.get('ELECTRIC_URL');

    if (!isNonEmptyString(electricUrl)) {
      throw new NotFoundException(
        'Local-first sync is not enabled on this server',
      );
    }

    const columns = LOCAL_FIRST_SYNCED_TABLES[tableName];

    if (!isDefined(columns)) {
      throw new NotFoundException(
        `Table "${tableName}" is not available for local-first sync`,
      );
    }

    const params = new URLSearchParams({
      table: `"${workspaceSchema}"."${tableName}"`,
      columns: columns.map((column) => `"${column}"`).join(','),
    });

    for (const param of FORWARDED_QUERY_PARAMS) {
      const value = query[param];

      if (isNonEmptyString(value)) {
        params.set(param, value);
      }
    }

    let electricResponse: globalThis.Response;

    try {
      electricResponse = await fetch(`${electricUrl}/v1/shape?${params}`);
    } catch {
      throw new BadGatewayException('Electric sync service is unreachable');
    }

    response.status(electricResponse.status);

    // The sync protocol lives in these headers; a cross-origin frontend (dev
    // runs on another port) can only read them if they're explicitly exposed.
    response.setHeader(
      'Access-Control-Expose-Headers',
      FORWARDED_RESPONSE_HEADERS.join(', '),
    );

    for (const header of FORWARDED_RESPONSE_HEADERS) {
      const value = electricResponse.headers.get(header);

      if (isDefined(value)) {
        response.setHeader(header, value);
      }
    }

    response.send(Buffer.from(await electricResponse.arrayBuffer()));
  }
}
