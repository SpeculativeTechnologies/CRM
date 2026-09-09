import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { type LocalFirstScope } from '@/local-first/types/LocalFirstScope';
import { getLocalFirstScopeKey } from '@/local-first/utils/getLocalFirstScopeKey';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const getCurrentLocalFirstScope = (): LocalFirstScope | null => {
  const user = jotaiStore.get(currentUserState.atom);
  const workspace = jotaiStore.get(currentWorkspaceState.atom);

  if (!user || !workspace) return null;

  return {
    serverUrl: REACT_APP_SERVER_BASE_URL,
    workspaceId: workspace.id,
    userId: user.id,
  };
};

export const assertLocalFirstScopeIsCurrent = (scope: LocalFirstScope) => {
  const current = getCurrentLocalFirstScope();

  if (
    !current ||
    getLocalFirstScopeKey(current) !== getLocalFirstScopeKey(scope)
  ) {
    throw new Error('The local workspace session changed');
  }
};
