import { isDefined } from 'twenty-shared/utils';
import { MCP_READ_ONLY_PATH } from 'src/engine/api/mcp/constants/mcp-read-only-path.const';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { cleanServerUrl } from 'src/utils/clean-server-url';

export const assertIssuerIsPublishedOrThrow = ({
  issuer,
  requestBaseUrl,
  serverUrl,
}: {
  issuer: string;
  requestBaseUrl: string;
  serverUrl?: string;
}): void => {
  const publishedIssuers = [requestBaseUrl, cleanServerUrl(serverUrl)]
    .filter(isDefined)
    .flatMap((base) => [base, `${base}${MCP_READ_ONLY_PATH}`]);

  if (!publishedIssuers.includes(issuer)) {
    throw new AuthException(
      `Unknown issuer '${issuer}'`,
      AuthExceptionCode.FORBIDDEN_EXCEPTION,
    );
  }
};
