import { useFieldMetadataItemById } from '@/object-metadata/hooks/useFieldMetadataItemById';
import { useUpdateOneFieldMetadataItem } from '@/object-metadata/hooks/useUpdateOneFieldMetadataItem';
import { type FieldMetadataItemOption } from '@/object-metadata/types/FieldMetadataItem';
import { getNewSelectOptionErrorMessage } from '@/object-record/record-field/ui/meta-types/utils/getNewSelectOptionErrorMessage';
import { generateNewSelectOption } from '@/settings/data-model/fields/forms/select/utils/generateNewSelectOption';
import { useCallback } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { useToast } from 'twenty-ui/components';

export const useAddSelectOption = (fieldMetadataId: string) => {
  const { fieldMetadataItem, objectMetadataItem } =
    useFieldMetadataItemById(fieldMetadataId);
  const { updateOneFieldMetadataItem } = useUpdateOneFieldMetadataItem();
  const { enqueueToast } = useToast();

  const addSelectOption = useCallback(
    async (
      optionName: string,
    ): Promise<FieldMetadataItemOption | undefined> => {
      const currentOptions = fieldMetadataItem?.options;

      if (!isDefined(currentOptions) || !isDefined(objectMetadataItem)) {
        return undefined;
      }

      const newOption = generateNewSelectOption(currentOptions, optionName);

      const validationErrorMessage = getNewSelectOptionErrorMessage({
        optionName,
        newOptionValue: newOption.value,
        currentOptions,
      });

      if (isDefined(validationErrorMessage)) {
        enqueueToast({ variant: 'error', children: validationErrorMessage });

        return undefined;
      }

      const result = await updateOneFieldMetadataItem({
        objectMetadataId: objectMetadataItem.id,
        fieldMetadataIdToUpdate: fieldMetadataId,
        updatePayload: { options: [...currentOptions, newOption] },
      });

      return result.status === 'successful' ? newOption : undefined;
    },
    [
      fieldMetadataId,
      fieldMetadataItem?.options,
      objectMetadataItem,
      updateOneFieldMetadataItem,
      enqueueToast,
    ],
  );

  return { addSelectOption };
};
