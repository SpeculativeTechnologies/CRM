import { SORTABLE_FIELD_METADATA_TYPES } from '@/object-metadata/constants/SortableFieldMetadataTypes';
import { isHiddenSystemField } from '@/object-metadata/utils/isHiddenSystemField';
import { isManyToOneRelationField } from '@/object-metadata/utils/isManyToOneRelationField';
import { FieldMetadataType, RelationType } from '~/generated-metadata/graphql';
import { getLinkedFieldReference, isDefined } from 'twenty-shared/utils';

type SortableFieldInput = {
  isSystem?: boolean | null;
  isActive?: boolean | null;
  name: string;
  type: FieldMetadataType;
  relation?: { type: RelationType } | null;
  settings?: unknown;
};

export const filterSortableFieldMetadataItems = (field: SortableFieldInput) => {
  const isFieldActive = field.isActive;

  const isFieldTypeSortable = SORTABLE_FIELD_METADATA_TYPES.includes(
    field.type,
  );
  const isLinkedListRelation =
    field.type === FieldMetadataType.RELATION &&
    field.relation?.type === RelationType.ONE_TO_MANY &&
    isDefined(getLinkedFieldReference(field.settings));

  return (
    !isHiddenSystemField(field) &&
    isFieldActive &&
    (isFieldTypeSortable ||
      isManyToOneRelationField(field) ||
      isLinkedListRelation)
  );
};
