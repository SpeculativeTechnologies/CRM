import { type ClientConfig } from '@/client-config/types/ClientConfig';
import { isDefined } from 'twenty-shared/utils';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

// index.html starts this fetch before the JS bundle finishes loading; the
// promise is single-use because a Response body can only be read once.
const consumeClientConfigPreflight = async (): Promise<Response | null> => {
  const preflight = window.__clientConfigPreflight;
  window.__clientConfigPreflight = undefined;

  if (!isDefined(preflight)) {
    return null;
  }

  try {
    const response = await preflight;

    return response !== null && response.ok ? response : null;
  } catch {
    return null;
  }
};

export const getClientConfig = async (): Promise<ClientConfig> => {
  const response =
    (await consumeClientConfigPreflight()) ??
    (await fetch(`${REACT_APP_SERVER_BASE_URL}/client-config`));

  if (!response.ok) {
    throw new Error(
      `Failed to fetch client config: ${response.status} ${response.statusText}`,
    );
  }

  const clientConfig: ClientConfig = await response.json();

  return clientConfig;
};
