import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { useContext, type ReactElement } from 'react';
import { OverflowingList } from 'twenty-ui/components';
import { themeCssVariables } from 'twenty-ui/theme';

import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';

const StyledVerticalList = styled.ul`
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
`;

const StyledVerticalListItem = styled.li`
  display: flex;
`;

export const FieldDisplayList = ({
  children,
  isChipCountDisplayed,
  maxInlineCount,
}: {
  children: ReactElement[];
  isChipCountDisplayed?: boolean;
  maxInlineCount?: number;
}) => {
  const { t } = useLingui();
  const { isInSidePanel } = useContext(FieldContext);

  if (isInSidePanel === true) {
    return (
      <StyledVerticalList>
        {children.map((child, index) => (
          <StyledVerticalListItem key={child.key ?? index}>
            {child}
          </StyledVerticalListItem>
        ))}
      </StyledVerticalList>
    );
  }

  return (
    <OverflowingList
      overflowLabel={t`Show all items`}
      showOverflowCount={isChipCountDisplayed}
      maxInlineCount={maxInlineCount}
    >
      {children}
    </OverflowingList>
  );
};
