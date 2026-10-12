import { COMMAND_MENU_DROPDOWN_CLICK_OUTSIDE_ID } from '@/command-menu-item/constants/CommandMenuDropdownClickOutsideId';
import { styled } from '@linaria/react';
import { type ReactNode } from 'react';

const StyledContainer = styled.div`
  display: contents;
`;

type RecordContextMenuClickOutsideExclusionProps = {
  children: ReactNode;
};

// Board and calendar views clear their selection on any click outside them,
// which would close this menu before an item could act on the record.
export const RecordContextMenuClickOutsideExclusion = ({
  children,
}: RecordContextMenuClickOutsideExclusionProps) => (
  <StyledContainer
    data-click-outside-id={COMMAND_MENU_DROPDOWN_CLICK_OUTSIDE_ID}
  >
    {children}
  </StyledContainer>
);
