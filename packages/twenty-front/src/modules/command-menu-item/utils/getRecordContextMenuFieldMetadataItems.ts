import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { isFieldCellSupported } from '@/object-record/utils/isFieldCellSupported';
import { FieldMetadataType } from '~/generated-metadata/graphql';

const CONTACT_FIELD_TYPES: FieldMetadataType[] = [
  FieldMetadataType.EMAILS,
  FieldMetadataType.PHONES,
  FieldMetadataType.LINKS,
];

// These either have no inline editor or need a full-page editor, so a small
// popover anchored to the cursor would be the wrong place to edit them.
const UNSUPPORTED_FIELD_TYPES: FieldMetadataType[] = [
  FieldMetadataType.ACTOR,
  FieldMetadataType.FILES,
  FieldMetadataType.RAW_JSON,
  FieldMetadataType.RICH_TEXT,
  FieldMetadataType.TS_VECTOR,
  FieldMetadataType.UUID,
];

const TIMESTAMP_FIELD_NAMES = ['createdAt', 'updatedAt', 'deletedAt'];

type GetRecordContextMenuFieldMetadataItemsParams = {
  objectMetadataItem: EnrichedObjectMetadataItem;
  objectMetadataItems: EnrichedObjectMetadataItem[];
  isFieldReadOnly: (fieldMetadataItem: FieldMetadataItem) => boolean;
};

export const getRecordContextMenuFieldMetadataItems = ({
  objectMetadataItem,
  objectMetadataItems,
  isFieldReadOnly,
}: GetRecordContextMenuFieldMetadataItemsParams) => {
  const editableFieldMetadataItems = objectMetadataItem.readableFields
    .filter(
      (fieldMetadataItem) =>
        isFieldCellSupported(fieldMetadataItem, objectMetadataItems) &&
        !UNSUPPORTED_FIELD_TYPES.includes(fieldMetadataItem.type) &&
        !TIMESTAMP_FIELD_NAMES.includes(fieldMetadataItem.name) &&
        !isFieldReadOnly(fieldMetadataItem),
    )
    .sort((fieldMetadataItemA, fieldMetadataItemB) =>
      fieldMetadataItemA.label.localeCompare(fieldMetadataItemB.label),
    );

  const contactFieldMetadataItems = editableFieldMetadataItems.filter(
    (fieldMetadataItem) => CONTACT_FIELD_TYPES.includes(fieldMetadataItem.type),
  );

  return { contactFieldMetadataItems, editableFieldMetadataItems };
};
