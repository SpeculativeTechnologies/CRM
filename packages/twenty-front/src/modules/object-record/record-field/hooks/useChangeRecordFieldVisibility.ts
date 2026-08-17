import { isFieldMetadataItemLabelIdentifierSelector } from '@/object-metadata/states/isFieldMetadataItemLabelIdentifierSelector';
import { useUpdateRecordField } from '@/object-record/record-field/hooks/useUpdateRecordField';
import { useUpsertRecordField } from '@/object-record/record-field/hooks/useUpsertRecordField';
import { currentRecordFieldsComponentState } from '@/object-record/record-field/states/currentRecordFieldsComponentState';
import { type RecordField } from '@/object-record/record-field/types/RecordField';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useSaveCurrentViewFields } from '@/views/hooks/useSaveCurrentViewFields';
import { computeLabelIdentifierViewFieldPosition } from '@/views/utils/computeLabelIdentifierViewFieldPosition';
import { mapRecordFieldToViewField } from '@/views/utils/mapRecordFieldToViewField';
import { useStore } from 'jotai';
import { isDefined } from 'twenty-shared/utils';
import { v4 } from 'uuid';
import { sortByProperty } from '~/utils/array/sortByProperty';

export const useChangeRecordFieldVisibility = (
  recordFieldComponentInstanceId?: string,
) => {
  const currentRecordFields = useAtomComponentStateValue(
    currentRecordFieldsComponentState,
    recordFieldComponentInstanceId,
  );

  const { updateRecordField } = useUpdateRecordField(
    recordFieldComponentInstanceId,
  );
  const { upsertRecordField } = useUpsertRecordField(
    recordFieldComponentInstanceId,
  );

  const { saveViewFields } = useSaveCurrentViewFields();

  const store = useStore();

  const changeRecordFieldVisibility = async ({
    fieldMetadataId,
    isVisible,
  }: {
    fieldMetadataId: string;
    isVisible: boolean;
  }) => {
    const lastPosition =
      currentRecordFields.toSorted(sortByProperty('position', 'desc'))?.[0]
        ?.position ?? 0;

    const isLabelIdentifier = store.get(
      isFieldMetadataItemLabelIdentifierSelector.selectorFamily({
        fieldMetadataItemId: fieldMetadataId,
      }),
    );

    const shouldShowFieldMetadataItem = isVisible === true;
    const correspondingRecordField = currentRecordFields.find(
      (recordFieldToFind) =>
        recordFieldToFind.fieldMetadataItemId === fieldMetadataId,
    );

    const noExistingRecordField = !isDefined(correspondingRecordField);

    if (noExistingRecordField) {
      const recordFieldToUpsert: RecordField = {
        id: v4(),
        fieldMetadataItemId: fieldMetadataId,
        size: 100,
        isVisible: shouldShowFieldMetadataItem,
        position: isLabelIdentifier
          ? computeLabelIdentifierViewFieldPosition(
              currentRecordFields.map(({ position }) => position),
            )
          : lastPosition + 1,
      };

      upsertRecordField(recordFieldToUpsert);

      await saveViewFields([mapRecordFieldToViewField(recordFieldToUpsert)]);
    } else {
      updateRecordField(fieldMetadataId, {
        isVisible: shouldShowFieldMetadataItem,
      });

      const updatedRecordField: RecordField = {
        ...correspondingRecordField,
        isVisible: shouldShowFieldMetadataItem,
      };

      saveViewFields([mapRecordFieldToViewField(updatedRecordField)]);
    }
  };

  return {
    changeRecordFieldVisibility,
  };
};
