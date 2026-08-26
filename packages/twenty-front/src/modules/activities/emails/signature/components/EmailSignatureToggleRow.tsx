import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useId } from 'react';
import { Toggle } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledLabel = styled.label`
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
`;

type EmailSignatureToggleRowProps = {
  isIncluded: boolean;
  onChange: (isIncluded: boolean) => void;
};

export const EmailSignatureToggleRow = ({
  isIncluded,
  onChange,
}: EmailSignatureToggleRowProps) => {
  const toggleId = useId();

  return (
    <StyledRow>
      <Toggle
        id={toggleId}
        toggleSize="small"
        value={isIncluded}
        onChange={onChange}
      />
      <StyledLabel htmlFor={toggleId}>{t`Add my signature`}</StyledLabel>
    </StyledRow>
  );
};
