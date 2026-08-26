import type { UI_SCALE_VALUES } from 'twenty-shared/constants';
import { type OpenRecordIn } from 'twenty-shared/types';
import {
  type WorkspaceMemberDateFormatEnum,
  type WorkspaceMemberNumberFormatEnum,
  type WorkspaceMemberTimeFormatEnum,
} from '~/generated-metadata/graphql';

export type ColorScheme = 'Dark' | 'Light' | 'System';

export type UiScale = (typeof UI_SCALE_VALUES)[number];

export type WorkspaceMember = {
  __typename: 'WorkspaceMember';
  id: string;
  name: {
    __typename?: 'FullName';
    firstName: string;
    lastName: string;
  };
  avatarUrl?: string | null;
  locale: string | null;
  colorScheme: ColorScheme;
  uiScale?: UiScale | null;
  openRecordIn?: OpenRecordIn;
  createdAt: string;
  updatedAt: string;
  userEmail: string;
  jobTitle?: string | null;
  userId: string;
  userWorkspaceId?: string | null;
  timeZone?: string | null;
  dateFormat?: WorkspaceMemberDateFormatEnum | null;
  timeFormat?: WorkspaceMemberTimeFormatEnum | null;
  numberFormat?: WorkspaceMemberNumberFormatEnum | null;
  calendarStartDay?: number | null;
  // Serialized TipTap document, or null/undefined on workspaces that predate
  // the field and on workspace members cached before it existed.
  emailSignature?: string | null;
  isEmailSignatureIncludedByDefault?: boolean | null;
};

export type WorkspaceInvitation = {
  __typename: 'WorkspaceInvitation';
  id: string;
  email: string;
  roleId?: string | null;
  expiresAt: string;
};
