import { McpProtocolService } from 'src/engine/api/mcp/services/mcp-protocol.service';
import { McpToolExecutorService } from 'src/engine/api/mcp/services/mcp-tool-executor.service';
import { type FlatWorkspace } from 'src/engine/core-modules/workspace/types/flat-workspace.type';

describe('Read-only MCP dispatch', () => {
  const read = jest.fn().mockResolvedValue({ success: true });
  const getCatalog = jest.fn();
  const service = new McpProtocolService(
    { getCatalog } as never,
    { getRoleIdForUserWorkspace: jest.fn().mockResolvedValue('role') } as never,
    new McpToolExecutorService({
      recordHistogram: jest.fn(),
      incrementCounterBy: jest.fn(),
    } as never),
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      buildToolSet: jest
        .fn()
        .mockResolvedValue({ find_many_people: { execute: read } }),
    } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it.each([false, true])(
    'should reject writes and generic dispatch regardless of direct mode (%s)',
    async (isDirectMode) => {
      for (const name of [
        'execute_tool',
        'create_one_person',
        'update_one_person',
        'delete_one_person',
        'run_workflow',
        'execute_code',
        'unknown_tool',
      ]) {
        const response = await service.handleMCPCoreQuery(
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name, arguments: {} },
          },
          {
            workspace: { id: 'workspace' } as FlatWorkspace,
            userWorkspaceId: 'member',
            apiKey: undefined,
            isDirectMode,
            isReadOnlyMode: true,
          },
        );
        expect(response).toMatchObject({ error: { code: -32602 } });
      }
      expect(read).not.toHaveBeenCalled();
      expect(getCatalog).not.toHaveBeenCalled();
    },
  );
});
