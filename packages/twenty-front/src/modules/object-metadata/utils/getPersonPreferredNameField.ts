import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { FieldMetadataType } from 'twenty-shared/types';

export const getPersonPreferredNameField = ({
  nameSingular,
  fields,
}: {
  nameSingular: string;
  fields: FieldMetadataItem[];
}) =>
  nameSingular === 'person'
    ? fields.find(
        (field) =>
          field.name === 'preferredName' &&
          field.type === FieldMetadataType.TEXT &&
          field.isActive,
      )
    : undefined;
