import { isCookieAuthActiveState } from '@/auth/states/isCookieAuthActiveState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { getSseClientAuthHeaders } from '@/sse-db-event/utils/getSseClientAuthHeaders';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';

// Same auth contract as the SSE client: cookie mode rides on
// credentials: 'include', token mode sends the bearer. Read from the store at
// call time because these requests outlive any one token, and because
// jotaiStore is reassigned on reset.
export const getLocalFirstAuthHeaders = (): Record<string, string> =>
  getSseClientAuthHeaders({
    isCookieAuthActive: jotaiStore.get(isCookieAuthActiveState.atom),
    tokenPair: jotaiStore.get(tokenPairState.atom),
  });
