import { FieldDisplayList } from '@/object-record/record-field/ui/components/FieldDisplayList';
import { type FieldMultiSelectValue } from '@/object-record/record-field/ui/types/FieldMetadata';
import { isDefined } from 'twenty-shared/utils';
import { Tag } from 'twenty-ui/data-display';
import { type SelectOption } from 'twenty-ui/input';

export const MultiSelectDisplay = ({
  values,
  options,
}: {
  values: FieldMultiSelectValue | undefined;
  options: SelectOption[];
}) => {
  const selectedOptions = values
    ? options?.filter((option) => values.includes(option.value))
    : [];

  if (!isDefined(selectedOptions)) return null;

  return (
    <FieldDisplayList>
      {selectedOptions.map((selectedOption) => (
        <Tag
          preventShrink
          key={selectedOption.value}
          color={selectedOption.color ?? 'transparent'}
          text={selectedOption.label}
          Icon={selectedOption.Icon ?? undefined}
        />
      ))}
    </FieldDisplayList>
  );
};
