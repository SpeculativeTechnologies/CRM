import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

// Constructing a formatter and resolving its options costs enough to show up
// in a profile when every date cell in a record table does it on each render.
// The system zone cannot change within a session, so it is resolved once.
let cachedSystemTimeZone: string | null = null;

const getSystemTimeZone = () => {
  cachedSystemTimeZone ??= Intl.DateTimeFormat().resolvedOptions().timeZone;

  return cachedSystemTimeZone;
};

export const useUserTimezone = () => {
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const systemTimeZone = getSystemTimeZone();

  const userTimezone =
    currentWorkspaceMember?.timeZone !== 'system'
      ? (currentWorkspaceMember?.timeZone ?? systemTimeZone)
      : systemTimeZone;

  const isSystemTimezone = userTimezone === systemTimeZone;

  return {
    userTimezone,
    isSystemTimezone,
    systemTimeZone,
  };
};
