import { type CommonPropertiesJwtPayload } from 'src/engine/core-modules/auth/types/common-properties-jwt-payload.type';
import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/jwt-token-type.enum';

export type ApplicationAccessTokenJwtPayload = CommonPropertiesJwtPayload & {
  type:
    | JwtTokenTypeEnum.APPLICATION_ACCESS
    | JwtTokenTypeEnum.MCP_READ_ONLY_ACCESS;
  workspaceId: string;
  applicationId: string;
  userWorkspaceId?: string;
  userId?: string;
  workspaceDeletionRequestTimestamp?: string;
  mcpReadOnlyResource?: string;
};
