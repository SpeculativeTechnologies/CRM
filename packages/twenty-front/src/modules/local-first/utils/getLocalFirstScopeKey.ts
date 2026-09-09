import { type LocalFirstScope } from '@/local-first/types/LocalFirstScope';

export const getLocalFirstScopeKey = (scope: LocalFirstScope): string =>
  encodeURIComponent(
    JSON.stringify([scope.serverUrl, scope.workspaceId, scope.userId]),
  );
