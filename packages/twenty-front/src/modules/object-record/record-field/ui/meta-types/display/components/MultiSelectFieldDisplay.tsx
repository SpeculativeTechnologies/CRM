import { FieldDisplayList } from '@/object-record/record-field/ui/components/FieldDisplayList';
import { useFieldFocus } from '@/object-record/record-field/ui/hooks/useFieldFocus';
import { useMultiSelectFieldDisplay } from '@/object-record/record-field/ui/meta-types/hooks/useMultiSelectFieldDisplay';
import { Tag } from 'twenty-ui/data-display';
import { isDefined } from 'twenty-shared/utils';

export const MultiSelectFieldDisplay = () => {
  const { fieldValue, fieldDefinition } = useMultiSelectFieldDisplay();

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

  return (
    <FieldDisplayList isChipCountDisplayed={isFocused}>{tags}</FieldDisplayList>
  );
};
