import { type JwtPayload } from 'src/engine/core-modules/auth/types/jwt-payload.type';
import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/jwt-token-type.enum';
import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';

// Restricted credentials must fail closed for callers without an HTTP resource,
// including websocket authentication and direct Passport strategy consumers.
export const assertMcpReadOnlyResource = (
  payload: JwtPayload,
  expectedResource?: string,
): void => {
  if (
    payload.type !== JwtTokenTypeEnum.MCP_READ_ONLY_ACCESS &&
    !('mcpReadOnlyResource' in payload)
  ) {
    return;
  }

  if (
    payload.type !== JwtTokenTypeEnum.MCP_READ_ONLY_ACCESS ||
    typeof payload.mcpReadOnlyResource !== 'string' ||
    !expectedResource ||
    payload.mcpReadOnlyResource !== expectedResource
  ) {
    throw new AuthException(
      'This token is restricted to its read-only MCP resource',
      AuthExceptionCode.FORBIDDEN_EXCEPTION,
    );
  }
};
