import { useContext } from 'react';

import { type FieldFullNameValue } from '@/object-record/record-field/ui/types/FieldMetadata';

import { useRecordFieldValue } from '@/object-record/record-store/hooks/useRecordFieldValue';
import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { FieldMetadataType } from 'twenty-shared/types';
import { getPreferredFirstName } from 'twenty-shared/utils';

export const useFullNameFieldDisplay = () => {
  const { recordId, fieldDefinition } = useContext(FieldContext);

  const fieldName = fieldDefinition.metadata.fieldName;

  const fieldValue = useRecordFieldValue<FieldFullNameValue | undefined>(
    recordId,
    fieldName,
    fieldDefinition,
  );
  const preferredName = useRecordFieldValue<unknown>(
    recordId,
    'preferredName',
    {
      type: FieldMetadataType.TEXT,
      metadata: {
        fieldName: 'preferredName',
        placeHolder: '',
        objectMetadataNameSingular:
          fieldDefinition.metadata.objectMetadataNameSingular,
      },
    },
  );
  const isPersonName =
    fieldName === 'name' &&
    fieldDefinition.metadata.objectMetadataNameSingular === 'person';

  return {
    fieldDefinition,
    fieldValue: isPersonName
      ? {
          firstName: getPreferredFirstName(
            fieldValue?.firstName,
            preferredName,
          ),
          lastName: fieldValue?.lastName ?? '',
        }
      : fieldValue,
  };
};
