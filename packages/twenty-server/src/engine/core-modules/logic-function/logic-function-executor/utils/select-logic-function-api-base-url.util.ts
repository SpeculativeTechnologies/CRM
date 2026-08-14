import { isNonEmptyString } from '@sniptt/guards';

import { cleanServerUrl } from 'src/utils/clean-server-url';

// Logic functions may run on hosts where SERVER_URL is only reachable through
// an authenticating proxy; LOGIC_FUNCTION_API_URL lets them call the API on an
// internal address instead.
export const selectLogicFunctionApiBaseUrl = ({
  logicFunctionApiUrl,
  serverUrl,
}: {
  logicFunctionApiUrl?: string;
  serverUrl?: string;
}): string | undefined =>
  cleanServerUrl(
    isNonEmptyString(logicFunctionApiUrl) ? logicFunctionApiUrl : serverUrl,
  );
