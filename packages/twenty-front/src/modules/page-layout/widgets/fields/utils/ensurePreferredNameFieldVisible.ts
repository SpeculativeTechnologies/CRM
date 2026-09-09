import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { type FieldsWidgetGroup } from '@/page-layout/widgets/fields/types/FieldsWidgetGroup';
import { isDefined } from 'twenty-shared/utils';

export const ensurePreferredNameFieldVisible = (
  groups: FieldsWidgetGroup[],
  preferredNameField: FieldMetadataItem | undefined,
): FieldsWidgetGroup[] => {
  if (
    !isDefined(preferredNameField) ||
    groups.some((group) =>
      group.fields.some(
        (field) => field.fieldMetadataItem.id === preferredNameField.id,
      ),
    )
  ) {
    return groups;
  }

  // Saved profiles can omit fields added later. Keep this identity field
  // available through the normal field editor, even before it has a value.
  const field = {
    fieldMetadataItem: preferredNameField,
    position: 0,
    isVisible: true,
    globalIndex: 0,
  };
  const [firstGroup, ...remainingGroups] = groups;
  const result = isDefined(firstGroup)
    ? [
        { ...firstGroup, fields: [field, ...firstGroup.fields] },
        ...remainingGroups,
      ]
    : [
        {
          id: 'person-preferred-name',
          name: '',
          position: 0,
          isVisible: true,
          fields: [field],
        },
      ];
  let globalIndex = 0;

  return result.map((group) => ({
    ...group,
    fields: group.fields.map((groupField) => ({
      ...groupField,
      globalIndex: globalIndex++,
    })),
  }));
};
