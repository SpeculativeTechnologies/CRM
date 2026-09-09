import { applyLocalFirstShapeBatch } from '@/local-first/services/applyLocalFirstShapeBatch';
import { getCurrentLocalFirstScope } from '@/local-first/services/getCurrentLocalFirstScope';
import { startLocalFirstSync } from '@/local-first/services/startLocalFirstSync';

jest.mock('@/local-first/constants/IS_LOCAL_FIRST_ENABLED', () => ({
  IS_LOCAL_FIRST_ENABLED: true,
}));
jest.mock('@/local-first/constants/LOCAL_FIRST_MIRRORED_TABLES', () => ({
  LOCAL_FIRST_MIRRORED_TABLES: ['person'],
}));
jest.mock('@/local-first/services/getCurrentLocalFirstScope', () => ({
  getCurrentLocalFirstScope: jest.fn(),
  assertLocalFirstScopeIsCurrent: jest.fn(),
}));
jest.mock('@/local-first/services/applyLocalFirstShapeBatch', () => ({
  applyLocalFirstShapeBatch: jest.fn(),
}));
jest.mock('@/local-first/services/getLocalFirstMirror', () => ({
  getLocalFirstMirror: jest.fn(async () => ({
    scope: {
      serverUrl: 'http://localhost:3201',
      workspaceId: 'fixture',
      userId: 'fixture',
    },
    pg: {},
    tables: {},
    columnsByTable: {},
  })),
  fetchLocalFirstTableColumns: jest.fn(async () => [
    { name: 'id', dataType: 'uuid' },
  ]),
}));
jest.mock('@/local-first/services/localFirstReplicaState', () => ({
  ensureLocalFirstReplicaSchema: jest.fn(),
  readLocalFirstTableStates: jest.fn(async () => [
    {
      tableName: 'person',
      columns: [{ name: 'id', dataType: 'uuid' }],
      offset: '-1',
      handle: null,
      complete: false,
    },
  ]),
  resetLocalFirstTable: jest.fn(),
}));

describe('local replica sync lifecycle', () => {
  const originalFetch = global.fetch;
  const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
  const lockRequest = jest.fn((_name, _options, callback) => callback());

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: lockRequest },
    });
    jest.mocked(getCurrentLocalFirstScope).mockReturnValue({
      serverUrl: 'http://localhost:3201',
      workspaceId: 'fixture',
      userId: 'fixture',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks);
    else Reflect.deleteProperty(navigator, 'locks');
  });

  it('should make no sync request before a workspace is signed in', () => {
    jest.mocked(getCurrentLocalFirstScope).mockReturnValue(null);
    const stop = startLocalFirstSync({
      onStatusChange: jest.fn(),
      onTablesResolved: jest.fn(),
    });
    expect(lockRequest).not.toHaveBeenCalled();
    stop();
  });

  it('should abort an in-flight request and stop polling when its session is released', async () => {
    let requestSignal: AbortSignal | undefined;
    global.fetch = jest.fn(
      (_input, options) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = options?.signal ?? undefined;
          requestSignal?.addEventListener(
            'abort',
            () => reject(new Error('Aborted')),
            { once: true },
          );
        }),
    );
    const onStatusChange = jest.fn();
    const stop = startLocalFirstSync({
      onStatusChange,
      onTablesResolved: jest.fn(),
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    stop();
    await jest.advanceTimersByTimeAsync(10000);
    expect(requestSignal?.aborted).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(applyLocalFirstShapeBatch).not.toHaveBeenCalled();
    expect(onStatusChange).not.toHaveBeenCalledWith('offline');
  });
});
