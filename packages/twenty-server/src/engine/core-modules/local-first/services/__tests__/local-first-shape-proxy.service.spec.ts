import { BadGatewayException, NotFoundException } from '@nestjs/common';

import { type Response } from 'express';

import { LocalFirstShapeProxyService } from 'src/engine/core-modules/local-first/services/local-first-shape-proxy.service';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const buildService = (electricUrl: string | undefined) =>
  new LocalFirstShapeProxyService({
    get: jest.fn().mockReturnValue(electricUrl),
  } as unknown as TwentyConfigService);

const buildResponse = () => {
  const response = {
    status: jest.fn(),
    setHeader: jest.fn(),
    send: jest.fn(),
  };

  return response as unknown as Response & typeof response;
};

const buildElectricResponse = ({
  status = 200,
  headers = {},
  body = '[]',
}: {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
} = {}) =>
  new globalThis.Response(body, {
    status,
    headers,
  });

describe('LocalFirstShapeProxyService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should answer 404 when ELECTRIC_URL is not configured', async () => {
    const service = buildService(undefined);

    await expect(
      service.proxyShapeRequest({
        tableName: 'person',
        workspaceSchema: 'workspace_abc',
        query: {},
        response: buildResponse(),
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should answer 404 for a table outside the whitelist', async () => {
    const service = buildService('http://127.0.0.1:3010');

    await expect(
      service.proxyShapeRequest({
        tableName: 'apiKey',
        workspaceSchema: 'workspace_abc',
        query: {},
        response: buildResponse(),
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should scope the Electric request server-side and only forward sync params', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(buildElectricResponse());
    const service = buildService('http://127.0.0.1:3010');

    await service.proxyShapeRequest({
      tableName: 'person',
      workspaceSchema: 'workspace_abc',
      query: {
        offset: '-1',
        handle: 'h1',
        // A client must not be able to widen the shape.
        table: '"other_schema"."person"',
        columns: 'id,secret',
        where: '1=1',
      },
      response: buildResponse(),
    });

    const requestedUrl = new URL(String(fetchSpy.mock.calls[0][0]));

    expect(requestedUrl.origin).toBe('http://127.0.0.1:3010');
    expect(requestedUrl.searchParams.get('table')).toBe(
      '"workspace_abc"."person"',
    );
    expect(requestedUrl.searchParams.get('columns')).toContain('"id"');
    expect(requestedUrl.searchParams.get('columns')).not.toContain('secret');
    expect(requestedUrl.searchParams.get('offset')).toBe('-1');
    expect(requestedUrl.searchParams.get('handle')).toBe('h1');
    expect(requestedUrl.searchParams.get('where')).toBeNull();
  });

  it('should relay status, electric headers, and body, and expose the headers cross-origin', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildElectricResponse({
        headers: {
          'electric-offset': '0_0',
          'electric-handle': 'h1',
          'electric-up-to-date': '',
        },
        body: '[{"value":{"id":"1"}}]',
      }),
    );
    const service = buildService('http://127.0.0.1:3010');
    const response = buildResponse();

    await service.proxyShapeRequest({
      tableName: 'person',
      workspaceSchema: 'workspace_abc',
      query: { offset: '-1' },
      response,
    });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.setHeader).toHaveBeenCalledWith('electric-offset', '0_0');
    expect(response.setHeader).toHaveBeenCalledWith('electric-handle', 'h1');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Access-Control-Expose-Headers',
      expect.stringContaining('electric-offset'),
    );
    expect(response.send).toHaveBeenCalledWith(
      Buffer.from('[{"value":{"id":"1"}}]'),
    );
  });

  it('should answer 502 when Electric is unreachable', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('connection refused'));
    const service = buildService('http://127.0.0.1:3010');

    await expect(
      service.proxyShapeRequest({
        tableName: 'person',
        workspaceSchema: 'workspace_abc',
        query: {},
        response: buildResponse(),
      }),
    ).rejects.toThrow(BadGatewayException);
  });
});
