import { Test } from '@nestjs/testing';
import { type ToolExecuteFunction } from 'ai';
import { ToolCategory } from 'twenty-shared/ai';

import { McpReadOnlyToolsService } from 'src/engine/api/mcp/services/mcp-read-only-tools.service';
import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import { ToolExecutorService } from 'src/engine/core-modules/tool-provider/services/tool-executor.service';
import { ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { type FlatWorkspace } from 'src/engine/core-modules/workspace/types/flat-workspace.type';

describe('MCP read-only tools', () => {
  const read: ToolIndexEntry = {
    name: 'find_many_candidates',
    label: 'Find candidates',
    description: 'Search candidates',
    category: ToolCategory.DATABASE_CRUD,
    executionRef: {
      kind: 'database_crud',
      objectNameSingular: 'candidate',
      operation: 'find_many',
    },
  };
  const dispatch = jest.fn();
  const getCatalog = jest.fn();
  const context = {
    workspaceId: 'workspace',
    roleId: 'user-role',
    userWorkspaceId: 'member',
    userId: 'user',
    rolePermissionConfig: { intersectionOf: ['user-role', 'app-role'] },
  };
  let service: McpReadOnlyToolsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        McpReadOnlyToolsService,
        {
          provide: ToolRegistryService,
          useValue: {
            getCatalog,
            resolveSchemas: jest.fn(
              async ({ toolNames }: { toolNames: string[] }) =>
                new Map(
                  toolNames.map((name) => [
                    name,
                    { type: 'object', properties: {} },
                  ]),
                ),
            ),
          },
        },
        { provide: ToolExecutorService, useValue: { dispatch } },
        {
          provide: WorkspaceDomainsService,
          useValue: {
            buildWorkspaceURL: ({ pathname }: { pathname: string }) =>
              new URL(pathname, 'https://crm.example.com'),
          },
        },
      ],
    }).compile();
    service = module.get(McpReadOnlyToolsService);
  });

  it('should expose only read execution targets even when write tools have misleading names', async () => {
    getCatalog.mockResolvedValue([
      read,
      {
        ...read,
        name: 'find_one_secret',
        executionRef: {
          kind: 'database_crud',
          objectNameSingular: 'person',
          operation: 'update_one',
        },
      },
      {
        ...read,
        name: 'execute_tool',
        executionRef: { kind: 'static', toolId: 'execute_tool' },
      },
      {
        ...read,
        name: 'find_something',
        executionRef: { kind: 'logic_function', logicFunctionId: 'function' },
      },
    ]);

    const tools = await service.buildToolSet(context, {
      id: 'workspace',
    } as FlatWorkspace);

    expect(Object.keys(tools)).toEqual([
      'discover_crm_reads',
      'describe_crm_read',
      'read_crm',
    ]);
    const execute = tools.discover_crm_reads.execute as ToolExecuteFunction<
      unknown,
      unknown,
      undefined
    >;
    const result = await execute(
      { query: '' },
      { toolCallId: 'test', messages: [], context: undefined },
    );
    expect(result).toMatchObject({
      operations: [{ name: 'find_many_candidates' }],
    });
    expect((result as { operations: unknown[] }).operations).toHaveLength(1);
    expect(tools.read_crm).toMatchObject({
      annotations: { readOnlyHint: true, openWorldHint: false },
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('should retain user/app permission intersection and return record source URLs', async () => {
    getCatalog.mockResolvedValue([read]);
    dispatch.mockResolvedValue({
      success: true,
      recordReferences: [
        {
          objectNameSingular: 'candidate',
          recordId: 'record',
          displayName: 'Synthetic candidate',
        },
      ],
    });
    const tools = await service.buildToolSet(context, {
      id: 'workspace',
    } as FlatWorkspace);
    const execute = tools.read_crm.execute as ToolExecuteFunction<
      unknown,
      unknown,
      undefined
    >;
    const result = await execute(
      {
        operation: 'find_many_candidates',
        input: { select: ['id'], limit: 1 },
      },
      { toolCallId: 'test', messages: [], context: undefined },
    );

    expect(dispatch).toHaveBeenCalledWith(
      read,
      { select: ['id'], limit: 1, offset: 0 },
      context,
    );
    expect(result).toMatchObject({
      recordReferences: [
        { url: 'https://crm.example.com/object/candidate/record' },
      ],
    });
  });
  it.each([
    'execute_tool',
    'update_one_person',
    'find_one_secret',
    'run_workflow',
  ])(
    'should reject an unapproved operation requested through read_crm (%s)',
    async (operation) => {
      getCatalog.mockResolvedValue([read]);
      const tools = await service.buildToolSet(context, {
        id: 'workspace',
      } as FlatWorkspace);
      const execute = tools.read_crm.execute as ToolExecuteFunction<
        unknown,
        unknown,
        undefined
      >;
      await expect(
        execute(
          { operation, input: {} },
          { toolCallId: 'test', messages: [], context: undefined },
        ),
      ).rejects.toThrow('Unknown or unavailable');
      expect(dispatch).not.toHaveBeenCalled();
    },
  );

  it('should reject unbounded reads before dispatch', async () => {
    getCatalog.mockResolvedValue([read]);
    const tools = await service.buildToolSet(context, {
      id: 'workspace',
    } as FlatWorkspace);
    const execute = tools.read_crm.execute as ToolExecuteFunction<
      unknown,
      unknown,
      undefined
    >;
    await expect(
      execute(
        { operation: read.name, input: { select: ['id'], limit: 1000 } },
        { toolCallId: 'test', messages: [], context: undefined },
      ),
    ).rejects.toThrow();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
