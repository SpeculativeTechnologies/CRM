import { getCurrentLocalFirstScope } from '@/local-first/services/getCurrentLocalFirstScope';
import { getLocalFirstDatabase } from '@/local-first/services/getLocalFirstDatabase';
import { getLocalFirstMirror } from '@/local-first/services/getLocalFirstMirror';
import { readLocalFirstTableStates } from '@/local-first/services/localFirstReplicaState';

jest.mock('@/local-first/services/getCurrentLocalFirstScope', () => ({
  getCurrentLocalFirstScope: jest.fn(),
  assertLocalFirstScopeIsCurrent: jest.fn(),
}));
jest.mock('@/local-first/services/getLocalFirstDatabase', () => ({
  getLocalFirstDatabase: jest.fn(),
}));
jest.mock('@/local-first/services/localFirstReplicaState', () => ({
  initializeLocalFirstReplicaState: jest.fn(),
  readLocalFirstTableStates: jest.fn(),
}));

it('should see a schema synced by another tab without reopening or contacting the server', async () => {
  const scope = {
    serverUrl: 'http://localhost:3201',
    workspaceId: 'fixture',
    userId: 'fixture',
  };
  jest.mocked(getCurrentLocalFirstScope).mockReturnValue(scope);
  jest
    .mocked(getLocalFirstDatabase)
    .mockResolvedValue({} as Awaited<ReturnType<typeof getLocalFirstDatabase>>);
  jest.mocked(readLocalFirstTableStates).mockResolvedValue([]);
  const initial = await getLocalFirstMirror();
  expect(initial.columnsByTable).toEqual({});
  jest.mocked(readLocalFirstTableStates).mockResolvedValue([
    {
      tableName: 'person',
      columns: [
        { name: 'id', dataType: 'uuid' },
        { name: 'customField', dataType: 'text' },
      ],
      offset: '1_0',
      handle: 'shape-1',
      complete: true,
    },
  ]);
  const synced = await getLocalFirstMirror();
  expect(synced.columnsByTable.person).toEqual(['id', 'customField']);
  expect(getLocalFirstDatabase).toHaveBeenCalledTimes(1);
});
