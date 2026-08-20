import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { useGetFieldDisplayLabelText } from '@/object-record/record-field/ui/hooks/useGetFieldDisplayLabelText';
import { useRecordFieldValue } from '@/object-record/record-store/hooks/useRecordFieldValue';
import { isNonEmptyString } from '@sniptt/guards';
import { useContext } from 'react';
import { useCopyToClipboard } from '~/hooks/useCopyToClipboard';

export const useCopyFieldDisplayLabel = () => {
  const { recordId, fieldDefinition } = useContext(FieldContext);
  const { copyToClipboard } = useCopyToClipboard();
  const { getFieldDisplayLabelText } = useGetFieldDisplayLabelText();

  const fieldValue = useRecordFieldValue<unknown>(
    recordId,
    fieldDefinition.metadata.fieldName,
    fieldDefinition,
  );

  const copyFieldDisplayLabel = () => {
    const displayLabelText = getFieldDisplayLabelText({
      fieldDefinition,
      fieldValue,
    });

    if (!isNonEmptyString(displayLabelText)) {
      return;
    }

    copyToClipboard(displayLabelText);
  };

  return { copyFieldDisplayLabel };
};
