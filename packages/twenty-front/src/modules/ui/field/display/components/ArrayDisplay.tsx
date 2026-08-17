import { type FieldArrayValue } from '@/object-record/record-field/ui/types/FieldMetadata';
import { FieldDisplayList } from '@/object-record/record-field/ui/components/FieldDisplayList';
import { t } from '@lingui/core/macro';
import { Chip, ChipVariant } from 'twenty-ui/data-display';

type ArrayDisplayProps = {
  value: FieldArrayValue;
};

export const ArrayDisplay = ({ value }: ArrayDisplayProps) => {
  return (
    <FieldDisplayList>
      {value?.map((item, index) => (
        <Chip
          key={`${item}-${index}`}
          variant={ChipVariant.Highlighted}
          label={item}
          emptyLabel={t`Untitled`}
        />
      ))}
    </FieldDisplayList>
  );
};
