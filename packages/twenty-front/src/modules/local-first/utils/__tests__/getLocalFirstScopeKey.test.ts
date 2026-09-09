import { getLocalFirstScopeKey } from '@/local-first/utils/getLocalFirstScopeKey';

const SCOPE = {
  serverUrl: 'https://crm.example.invalid',
  workspaceId: 'workspace-1',
  userId: 'user-1',
};

describe('getLocalFirstScopeKey', () => {
  it.each(['serverUrl', 'workspaceId', 'userId'] as const)(
    'should isolate replicas when %s differs',
    (field) => {
      expect(
        getLocalFirstScopeKey({ ...SCOPE, [field]: 'different' }),
      ).not.toBe(getLocalFirstScopeKey(SCOPE));
    },
  );

  it('should distinguish scope components that contain separators', () => {
    expect(
      getLocalFirstScopeKey({ ...SCOPE, workspaceId: 'a:b', userId: 'c' }),
    ).not.toBe(
      getLocalFirstScopeKey({ ...SCOPE, workspaceId: 'a', userId: 'b:c' }),
    );
  });

  it('should reopen the same scope with the same stable key', () => {
    expect(getLocalFirstScopeKey({ ...SCOPE })).toBe(
      getLocalFirstScopeKey(SCOPE),
    );
  });
});
