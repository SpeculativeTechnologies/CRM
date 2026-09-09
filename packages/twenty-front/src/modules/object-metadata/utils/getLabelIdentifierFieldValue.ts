import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { getPreferredFirstName, isDefined } from 'twenty-shared/utils';
import { FieldMetadataType } from '~/generated-metadata/graphql';

export const getLabelIdentifierFieldValue = (
  record: ObjectRecord,
  labelIdentifierFieldMetadataItem: FieldMetadataItem | undefined,
  objectNameSingular?: string,
): string => {
  if (!isDefined(labelIdentifierFieldMetadataItem)) {
    return record.id;
  }

  const recordIdentifierValue = record[labelIdentifierFieldMetadataItem.name];
  if (labelIdentifierFieldMetadataItem.type === FieldMetadataType.FULL_NAME) {
    if (
      objectNameSingular === 'person' &&
      labelIdentifierFieldMetadataItem.name === 'name'
    ) {
      return `${getPreferredFirstName(recordIdentifierValue?.firstName, record.preferredName)} ${recordIdentifierValue?.lastName ?? ''}`.trim();
    }

    return `${recordIdentifierValue?.firstName ?? ''} ${recordIdentifierValue?.lastName ?? ''}`;
  }

  return isDefined(recordIdentifierValue) ? `${recordIdentifierValue}` : '';
};
