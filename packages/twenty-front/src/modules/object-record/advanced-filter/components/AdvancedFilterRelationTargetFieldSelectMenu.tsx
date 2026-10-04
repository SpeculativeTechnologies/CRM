import { ListItem } from 'twenty-ui/primitives/navigation';
import { SelectOptionIcon } from '@/ui/input/components/SelectOptionIcon';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { isManyToOneRelationField } from '@/object-metadata/utils/isManyToOneRelationField';
import { isOneToManyRelationField } from '@/object-metadata/utils/isOneToManyRelationField';
import { useAdvancedFilterFieldSelectDropdown } from '@/object-record/advanced-filter/hooks/useAdvancedFilterFieldSelectDropdown';
import { useApplyAdvancedFilterRelationTargetField } from '@/object-record/advanced-filter/hooks/useApplyAdvancedFilterRelationTargetField';
import { useApplyAdvancedFilterSourceField } from '@/object-record/advanced-filter/hooks/useApplyAdvancedFilterSourceField';
import { usePushFocusForLeafFieldValuePicker } from '@/object-record/advanced-filter/hooks/usePushFocusForLeafFieldValuePicker';
import { fieldMetadataItemUsedInDropdownComponentSelector } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemUsedInDropdownComponentSelector';
import { objectFilterDropdownIsSelectingRelationTargetFieldComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownIsSelectingRelationTargetFieldComponentState';
import { useFilterableFieldMetadataItems } from '@/object-record/record-filter/hooks/useFilterableFieldMetadataItems';
import { LegacyDropdownContent } from '@/ui/layout/dropdown/components/LegacyDropdownContent';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useWorkspaceSurfaceScopedComponentInstanceId } from '@/ui/layout/hooks/useWorkspaceSurfaceScopedComponentInstanceId';
import { SelectableList } from '@/ui/layout/selectable-list/components/SelectableList';
import { SelectableListItem } from '@/ui/layout/selectable-list/components/SelectableListItem';
import { selectedItemIdComponentState } from '@/ui/layout/selectable-list/states/selectedItemIdComponentState';
import { useAtomComponentSelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentSelectorValue';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { CoreObjectNameSingular, FieldMetadataType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { IconChevronLeft, useIcons } from 'twenty-ui/icon';

const RELATION_RECORD_SELECTABLE_ITEM_ID = 'relation-record-select';

type AdvancedFilterRelationTargetFieldSelectMenuProps = {
  recordFilterId: string;
};

export const AdvancedFilterRelationTargetFieldSelectMenu = ({
  recordFilterId,
}: AdvancedFilterRelationTargetFieldSelectMenuProps) => {
  const { getIcon } = useIcons();

  const sourceFieldMetadataItem = useAtomComponentSelectorValue(
    fieldMetadataItemUsedInDropdownComponentSelector,
  );

  const setObjectFilterDropdownIsSelectingRelationTargetField =
    useSetAtomComponentState(
      objectFilterDropdownIsSelectingRelationTargetFieldComponentState,
    );

  const { closeAdvancedFilterFieldSelectDropdown } =
    useAdvancedFilterFieldSelectDropdown(recordFilterId);

  const { applyAdvancedFilterRelationTargetField } =
    useApplyAdvancedFilterRelationTargetField();

  const { applyAdvancedFilterSourceField } =
    useApplyAdvancedFilterSourceField();

  const { pushFocusForLeafFieldValuePicker } =
    usePushFocusForLeafFieldValuePicker();

  const { advancedFilterFieldSelectDropdownId } =
    useAdvancedFilterFieldSelectDropdown(recordFilterId);

  const scopedAdvancedFilterFieldSelectDropdownId =
    useWorkspaceSurfaceScopedComponentInstanceId(
      advancedFilterFieldSelectDropdownId,
    );

  const selectedItemId = useAtomComponentStateValue(
    selectedItemIdComponentState,
    scopedAdvancedFilterFieldSelectDropdownId,
  );

  // Traversing works for both sides of a relation, not only many-to-one
  const isTraversableRelation =
    isDefined(sourceFieldMetadataItem) &&
    (isManyToOneRelationField(sourceFieldMetadataItem) ||
      isOneToManyRelationField(sourceFieldMetadataItem));

  const targetObjectMetadataId = isTraversableRelation
    ? sourceFieldMetadataItem.relation.targetObjectMetadata.id
    : null;

  const targetObjectNameSingular = isTraversableRelation
    ? sourceFieldMetadataItem.relation.targetObjectMetadata.nameSingular
    : CoreObjectNameSingular.WorkspaceMember;

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

  const handleSubMenuBack = () => {
    setObjectFilterDropdownIsSelectingRelationTargetField(false);
  };

  const handleSelectTargetField = (
    relationTargetFieldMetadataItem: FieldMetadataItem,
  ) => {
    applyAdvancedFilterRelationTargetField({
      sourceFieldMetadataItem,
      relationTargetFieldMetadataItem,
      recordFilterId,
    });

    pushFocusForLeafFieldValuePicker(relationTargetFieldMetadataItem);

    setObjectFilterDropdownIsSelectingRelationTargetField(false);
    closeAdvancedFilterFieldSelectDropdown();
  };

  const handleSelectRelationRecord = () => {
    applyAdvancedFilterSourceField({
      sourceFieldMetadataItem,
      recordFilterId,
    });

    setObjectFilterDropdownIsSelectingRelationTargetField(false);
    closeAdvancedFilterFieldSelectDropdown();
  };

  const selectableItemIdArray = [
    RELATION_RECORD_SELECTABLE_ITEM_ID,
    ...relationTargetFields.map((field) => field.id),
  ];

  return (
    <LegacyDropdownContent
      widthInPixels={GenericDropdownContentWidth.ExtraLarge}
    >
      <DropdownMenuHeader
        StartComponent={
          <DropdownMenuHeaderLeftComponent
            onClick={handleSubMenuBack}
            Icon={IconChevronLeft}
          />
        }
      >
        {sourceFieldMetadataItem.label}
      </DropdownMenuHeader>
      <DropdownMenuItemsContainer>
        <SelectableList
          focusId={advancedFilterFieldSelectDropdownId}
          selectableItemIdArray={selectableItemIdArray}
          selectableListInstanceId={advancedFilterFieldSelectDropdownId}
        >
          {/* Selecting the related record itself is valid for any relation target */}
          <SelectableListItem
            itemId={RELATION_RECORD_SELECTABLE_ITEM_ID}
            onEnter={handleSelectRelationRecord}
          >
            <ListItem
              focused={selectedItemId === RELATION_RECORD_SELECTABLE_ITEM_ID}
              data-testid={'select-filter-relation-record'}
              onClick={handleSelectRelationRecord}
              startIcon={
                <SelectOptionIcon
                  Icon={getIcon(targetObjectMetadataItem.icon)}
                />
              }
            >
              {targetObjectMetadataItem.labelSingular}
            </ListItem>
          </SelectableListItem>
          <DropdownMenuSeparator />
          {relationTargetFields.map((targetField, index) => (
            <SelectableListItem
              itemId={targetField.id}
              key={`select-filter-relation-${index}`}
              onEnter={() => {
                handleSelectTargetField(targetField);
              }}
            >
              <ListItem
                focused={selectedItemId === targetField.id}
                key={`select-filter-relation-${index}`}
                data-testid={`select-filter-relation-${index}`}
                onClick={() => {
                  handleSelectTargetField(targetField);
                }}
                startIcon={
                  <SelectOptionIcon Icon={getIcon(targetField.icon)} />
                }
              >
                {targetField.label}
              </ListItem>
            </SelectableListItem>
          ))}
        </SelectableList>
      </DropdownMenuItemsContainer>
    </LegacyDropdownContent>
  );
};
