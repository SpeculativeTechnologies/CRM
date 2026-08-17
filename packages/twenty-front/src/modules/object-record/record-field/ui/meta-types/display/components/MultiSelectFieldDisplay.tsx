import { styled } from '@linaria/react';
import { useContext } from 'react';

import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { useFieldFocus } from '@/object-record/record-field/ui/hooks/useFieldFocus';
import { useMultiSelectFieldDisplay } from '@/object-record/record-field/ui/meta-types/hooks/useMultiSelectFieldDisplay';
import { ExpandableList } from '@/ui/layout/expandable-list/components/ExpandableList';
import { Tag } from 'twenty-ui/data-display';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

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

export const MultiSelectFieldDisplay = () => {
  const { fieldValue, fieldDefinition } = useMultiSelectFieldDisplay();
  const { isInSidePanel } = useContext(FieldContext);

  const { isFocused } = useFieldFocus();

  const selectedOptions = fieldValue
    ? fieldDefinition.metadata.options?.filter((option) =>
        fieldValue.includes(option.value),
      )
    : [];

  if (!isDefined(selectedOptions)) return null;

  const tags = selectedOptions.map((selectedOption) => (
    <Tag
      key={selectedOption.value}
      color={selectedOption.color}
      text={selectedOption.label}
    />
  ));

  if (isInSidePanel) {
    return (
      <StyledVerticalList>
        {tags.map((tag) => (
          <StyledVerticalListItem key={tag.key}>{tag}</StyledVerticalListItem>
        ))}
      </StyledVerticalList>
    );
  }

  return (
    <ExpandableList isChipCountDisplayed={isFocused}>{tags}</ExpandableList>
  );
};
