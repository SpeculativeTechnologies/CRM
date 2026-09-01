import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

// Set when an authenticating reverse proxy (Cloudflare Access) has started
// answering the app's requests with a redirect to its own login origin. Kept in
// memory rather than storage: it describes the current tab's live session, and a
// reload resolves it one way or the other anyway.
export const isAuthProxySessionExpiredState = createAtomState<boolean>({
  key: 'isAuthProxySessionExpiredState',
  defaultValue: false,
});
