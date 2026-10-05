import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { isManyToOneRelationField } from '@/object-metadata/utils/isManyToOneRelationField';
import { isOneToManyRelationField } from '@/object-metadata/utils/isOneToManyRelationField';
import { useApplyAdvancedFilterRelationTargetField } from '@/object-record/advanced-filter/hooks/useApplyAdvancedFilterRelationTargetField';
import { useApplyAdvancedFilterSourceField } from '@/object-record/advanced-filter/hooks/useApplyAdvancedFilterSourceField';
import { usePushFocusForLeafFieldValuePicker } from '@/object-record/advanced-filter/hooks/usePushFocusForLeafFieldValuePicker';
import { useFilterableFieldMetadataItems } from '@/object-record/record-filter/hooks/useFilterableFieldMetadataItems';
import { SelectOptionIcon } from '@/ui/input/components/SelectOptionIcon';
import { t } from '@lingui/core/macro';
import { CoreObjectNameSingular, FieldMetadataType } from 'twenty-shared/types';
import { Dropdown } from 'twenty-ui/components';
import { useIcons } from 'twenty-ui/icon';

export const RELATION_RECORD_SELECTABLE_ITEM_TEST_ID =
  'select-filter-relation-record';

type AdvancedFilterRelationTargetFieldSelectMenuProps = {
  recordFilterId: string;
  sourceFieldMetadataItem: FieldMetadataItem;
};

export const AdvancedFilterRelationTargetFieldSelectMenu = ({
  recordFilterId,
  sourceFieldMetadataItem,
}: AdvancedFilterRelationTargetFieldSelectMenuProps) => {
  const { getIcon } = useIcons();
  const { applyAdvancedFilterRelationTargetField } =
    useApplyAdvancedFilterRelationTargetField();
  const { applyAdvancedFilterSourceField } =
    useApplyAdvancedFilterSourceField();
  const { pushFocusForLeafFieldValuePicker } =
    usePushFocusForLeafFieldValuePicker();

  // Fork: traversing works for both sides of a relation, not only
  // many-to-one.
  const isTraversableRelation =
    isManyToOneRelationField(sourceFieldMetadataItem) ||
    isOneToManyRelationField(sourceFieldMetadataItem);

  // Fork: resolve the actual relation target object instead of always
  // defaulting to workspaceMember, so the "filter by record" entry shows the
  // correct label/icon for any relation.
  const targetObjectNameSingular = isTraversableRelation
    ? sourceFieldMetadataItem.relation.targetObjectMetadata.nameSingular
    : CoreObjectNameSingular.WorkspaceMember;

  const targetObjectMetadataId = isTraversableRelation
    ? sourceFieldMetadataItem.relation.targetObjectMetadata.id
    : null;

  const { objectMetadataItem: targetObjectMetadataItem } =
    useObjectMetadataItem({
      objectNameSingular: targetObjectNameSingular,
    });

  const { filterableFieldMetadataItems } = useFilterableFieldMetadataItems(
    targetObjectMetadataId ?? '',
  );

  const relationTargetFields = filterableFieldMetadataItems.filter(
    (field) =>
      field.type !== FieldMetadataType.RELATION &&
      field.type !== FieldMetadataType.MORPH_RELATION,
  );

  if (!isTraversableRelation) {
    return null;
  }

  const handleSelectTargetField = (
    relationTargetFieldMetadataItem: FieldMetadataItem,
  ) => {
    applyAdvancedFilterRelationTargetField({
      sourceFieldMetadataItem,
      relationTargetFieldMetadataItem,
      recordFilterId,
    });
    pushFocusForLeafFieldValuePicker(relationTargetFieldMetadataItem);
  };

  const handleSelectRelationRecord = () => {
    applyAdvancedFilterSourceField({
      sourceFieldMetadataItem,
      recordFilterId,
    });
  };

  return (
    <>
      <Dropdown.Back
        aria-label={t`${sourceFieldMetadataItem.label}, back to fields`}
      >
        {sourceFieldMetadataItem.label}
      </Dropdown.Back>
      <Dropdown.Section>
        {/* Fork: selecting the related record itself is valid for any
        relation target, not only workspaceMember. */}
        <Dropdown.ActionItem
          data-testid={RELATION_RECORD_SELECTABLE_ITEM_TEST_ID}
          onClick={handleSelectRelationRecord}
          startIcon={
            <SelectOptionIcon Icon={getIcon(targetObjectMetadataItem.icon)} />
          }
        >
          {targetObjectMetadataItem.labelSingular}
        </Dropdown.ActionItem>
        <Dropdown.Separator />
        {relationTargetFields.map((targetField) => (
          <Dropdown.ActionItem
            key={targetField.id}
            onClick={() => handleSelectTargetField(targetField)}
            startIcon={<SelectOptionIcon Icon={getIcon(targetField.icon)} />}
          >
            {targetField.label}
          </Dropdown.ActionItem>
        ))}
      </Dropdown.Section>
    </>
  );
};
