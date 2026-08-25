import { styled } from '@linaria/react';
import { type MouseEventHandler, type ReactNode } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const ROW_MIN_HEIGHT = '40px';

const StyledRow = styled.div<{ $clickable: boolean }>`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  box-sizing: border-box;
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  min-height: ${ROW_MIN_HEIGHT};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]}
    ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[3]};
  width: 100%;

  &:last-of-type {
    border-bottom: none;
  }
`;

const StyledLabel = styled.label<{
  $minWidth: string | undefined;
  $isAssociatedWithInput: boolean;
}>`
  color: ${themeCssVariables.font.color.tertiary};
  cursor: ${({ $isAssociatedWithInput }) =>
    $isAssociatedWithInput ? 'text' : 'inherit'};
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.regular};
  min-width: ${({ $minWidth }) => $minWidth ?? 'auto'};

  /* Selecting the label text reads as editing the field, which is how an empty
     field gets mistaken for one that cannot be typed into. */
  user-select: none;
`;

const StyledContent = styled.div`
  align-items: center;
  display: flex;
  flex: 1;
  min-width: 0;
`;

const StyledTrailing = styled.div`
  align-items: center;
  display: flex;
`;

type ComposerFieldRowProps = {
  label: string;
  children: ReactNode;
  trailing?: ReactNode;
  onClick?: MouseEventHandler<HTMLDivElement>;
  // A floor, not a fixed width: mixed-length labels line up without a long
  // translation running underneath its control.
  labelMinWidth?: string;
  // Id of the input the row wraps. Rows around a single text input pass it so
  // the label names that input and clicking the label focuses it.
  labelFor?: string;
};

// Rows wrap composite controls such as recipient chip fields and selects, which
// take no label of their own, so the label cannot always be associated with an
// input. Naming the row as a group gives assistive technology the field name in
// that case; rows that do wrap a single input pass labelFor instead.
export const ComposerFieldRow = ({
  label,
  children,
  trailing,
  onClick,
  labelMinWidth,
  labelFor,
}: ComposerFieldRowProps) => {
  const isLabelAssociatedWithInput = isDefined(labelFor);

  return (
    <StyledRow
      role="group"
      aria-label={label}
      $clickable={isDefined(onClick)}
      onClick={onClick}
    >
      <StyledLabel
        htmlFor={labelFor}
        aria-hidden={isLabelAssociatedWithInput ? undefined : 'true'}
        $isAssociatedWithInput={isLabelAssociatedWithInput}
        $minWidth={labelMinWidth}
      >
        {label}
      </StyledLabel>
      <StyledContent>{children}</StyledContent>
      {isDefined(trailing) && (
        <StyledTrailing onClick={(event) => event.stopPropagation()}>
          {trailing}
        </StyledTrailing>
      )}
    </StyledRow>
  );
};
