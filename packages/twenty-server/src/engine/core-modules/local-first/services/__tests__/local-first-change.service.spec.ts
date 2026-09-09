import { createHash } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import { FieldMetadataType } from 'twenty-shared/types';

import { type CommonFindOneQueryRunnerService } from 'src/engine/api/common/common-query-runners/common-find-one-query-runner.service';
import { type CommonUpdateOneQueryRunnerService } from 'src/engine/api/common/common-query-runners/common-update-one-query-runner.service';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { LocalFirstChangeService } from 'src/engine/core-modules/local-first/services/local-first-change.service';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { getWorkspaceContext } from 'src/engine/twenty-orm/storage/orm-workspace-context.storage';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { type WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';

jest.mock(
  'src/engine/twenty-orm/storage/orm-workspace-context.storage',
  () => ({ getWorkspaceContext: jest.fn() }),
);

const OPERATION = {
  operationId: '00000000-0000-4000-8000-000000000001',
  objectId: '00000000-0000-4000-8000-000000000002',
  recordId: '00000000-0000-4000-8000-000000000003',
  changes: [
    {
      fieldId: '00000000-0000-4000-8000-000000000004',
      before: 'Original',
      after: 'Local',
    },
  ],
};
const AUTH_CONTEXT = {
  type: 'user',
  user: { id: '00000000-0000-4000-8000-000000000005' },
  workspace: {
    id: '00000000-0000-4000-8000-000000000006',
    databaseSchema: 'workspace_test',
  },
} as unknown as WorkspaceAuthContext;

describe('LocalFirstChangeService', () => {
  const rawQuery = jest.fn<
    Promise<Record<string, unknown>[]>,
    [string, unknown[]?]
  >();
  const transactionScope = {
    executeRawQuery: rawQuery,
  } as unknown as WorkspaceTransactionScope;
  const findOne = { execute: jest.fn() };
  const updateOne = { execute: jest.fn() };
  const config = { get: jest.fn() };
  const manager = {
    executeInWorkspaceContext: jest.fn(async (run: () => Promise<unknown>) =>
      run(),
    ),
    runInWorkspaceTransaction: jest.fn(
      async (run: (scope: WorkspaceTransactionScope) => Promise<unknown>) =>
        run(transactionScope),
    ),
  };
  const service = new LocalFirstChangeService(
    config as unknown as TwentyConfigService,
    manager as unknown as WorkspaceOrmManager,
    findOne as unknown as CommonFindOneQueryRunnerService,
    updateOne as unknown as CommonUpdateOneQueryRunnerService,
  );

  const expectedScope = {
    userId: '00000000-0000-4000-8000-000000000005',
    workspaceId: AUTH_CONTEXT.workspace.id,
  };
  const apply = (input: unknown, context: WorkspaceAuthContext) =>
    service.apply(input, context, expectedScope);

  it.each([
    { userId: 'different-user', workspaceId: AUTH_CONTEXT.workspace.id },
    {
      userId: '00000000-0000-4000-8000-000000000005',
      workspaceId: 'different-workspace',
    },
    { userId: undefined, workspaceId: undefined },
  ])(
    'should reject a journal from another or unspecified session before opening a transaction',
    async (scope) => {
      await expect(
        service.apply(OPERATION, AUTH_CONTEXT, scope),
      ).rejects.toThrow(ForbiddenException);
      expect(manager.executeInWorkspaceContext).not.toHaveBeenCalled();
    },
  );

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue(true);
    rawQuery.mockResolvedValue([]);
    findOne.execute.mockResolvedValue({
      results: { id: OPERATION.recordId, jobTitle: 'Original' },
    });
    updateOne.execute.mockResolvedValue({
      results: { id: OPERATION.recordId },
    });
    jest.mocked(getWorkspaceContext).mockReturnValue({
      authContext: AUTH_CONTEXT,
      flatObjectMetadataMaps: {
        universalIdentifierById: { [OPERATION.objectId]: 'object' },
        byUniversalIdentifier: {
          object: {
            id: OPERATION.objectId,
            nameSingular: 'person',
            isSystem: false,
            isRemote: false,
          },
        },
      },
      flatFieldMetadataMaps: {
        universalIdentifierById: { [OPERATION.changes[0].fieldId]: 'field' },
        byUniversalIdentifier: {
          field: {
            id: OPERATION.changes[0].fieldId,
            objectMetadataId: OPERATION.objectId,
            name: 'jobTitle',
            type: FieldMetadataType.TEXT,
            isSystem: false,
            isActive: true,
          },
        },
      },
    } as unknown as ReturnType<typeof getWorkspaceContext>);
  });

  it('should use the permission-aware runners and the same transaction for the record and receipt', async () => {
    await expect(apply(OPERATION, AUTH_CONTEXT)).resolves.toEqual({
      status: 'applied',
      operationId: OPERATION.operationId,
    });
    expect(findOne.execute.mock.calls[0][1].transactionScope).toBe(
      transactionScope,
    );
    expect(updateOne.execute).toHaveBeenCalledWith(
      {
        id: OPERATION.recordId,
        data: { jobTitle: 'Local' },
        selectedFields: { id: {} },
      },
      expect.objectContaining({ transactionScope }),
    );
    expect(
      rawQuery.mock.calls.some(([sql]) => sql.includes('FOR UPDATE')),
    ).toBe(true);
    expect(rawQuery.mock.calls[rawQuery.mock.calls.length - 1]?.[0]).toContain(
      'INSERT INTO core."localFirstOperation"',
    );
  });

  it('should return both sides of a conflict without writing or recording a successful receipt', async () => {
    findOne.execute.mockResolvedValue({
      results: { id: OPERATION.recordId, jobTitle: 'Server' },
    });
    await expect(apply(OPERATION, AUTH_CONTEXT)).resolves.toEqual({
      status: 'conflict',
      operationId: OPERATION.operationId,
      current: { [OPERATION.changes[0].fieldId]: 'Server' },
    });
    expect(updateOne.execute).not.toHaveBeenCalled();
    expect(rawQuery.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(
      false,
    );
  });

  it('should stop when record permissions reject the read', async () => {
    findOne.execute.mockRejectedValue(new ForbiddenException());
    await expect(apply(OPERATION, AUTH_CONTEXT)).rejects.toThrow(
      ForbiddenException,
    );
    expect(updateOne.execute).not.toHaveBeenCalled();
    expect(rawQuery.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(
      false,
    );
  });

  it('should never repeat a mutation when its matching receipt already exists', async () => {
    rawQuery.mockImplementation(async (sql) =>
      sql.startsWith('SELECT "requestHash"')
        ? [
            {
              workspaceId: AUTH_CONTEXT.workspace.id,
              requestHash: createHash('sha256')
                .update(JSON.stringify(OPERATION))
                .digest('hex'),
            },
          ]
        : [],
    );
    await expect(apply(OPERATION, AUTH_CONTEXT)).resolves.toEqual({
      status: 'applied',
      operationId: OPERATION.operationId,
    });
    expect(findOne.execute).not.toHaveBeenCalled();
    expect(updateOne.execute).not.toHaveBeenCalled();
  });

  it('should reject operation IDs reused with a different payload', async () => {
    rawQuery.mockImplementation(async (sql) =>
      sql.startsWith('SELECT "requestHash"')
        ? [{ workspaceId: AUTH_CONTEXT.workspace.id, requestHash: 'different' }]
        : [],
    );
    await expect(apply(OPERATION, AUTH_CONTEXT)).rejects.toThrow(
      'cannot be reused',
    );
    expect(updateOne.execute).not.toHaveBeenCalled();
  });

  it('should remain disabled unless the experiment is explicitly enabled', async () => {
    config.get.mockReturnValue(false);
    await expect(apply(OPERATION, AUTH_CONTEXT)).rejects.toThrow('disabled');
    expect(manager.executeInWorkspaceContext).not.toHaveBeenCalled();
  });

  it('should exclude system and API-key actions from local replay', async () => {
    await expect(
      apply(OPERATION, {
        type: 'system',
        workspace: AUTH_CONTEXT.workspace,
      }),
    ).rejects.toThrow('workspace member');
    expect(manager.executeInWorkspaceContext).not.toHaveBeenCalled();
  });
});
