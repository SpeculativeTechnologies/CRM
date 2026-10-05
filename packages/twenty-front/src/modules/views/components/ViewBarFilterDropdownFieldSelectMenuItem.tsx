import { ListItem } from 'twenty-ui/primitives/navigation';
import { SelectOptionIcon } from '@/ui/input/components/SelectOptionIcon';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { isManyToOneRelationField } from '@/object-metadata/utils/isManyToOneRelationField';
import { isOneToManyRelationField } from '@/object-metadata/utils/isOneToManyRelationField';
import { SelectableListItem } from '@/ui/layout/selectable-list/components/SelectableListItem';
import { useSelectableList } from '@/ui/layout/selectable-list/hooks/useSelectableList';
import { isSelectedItemIdComponentFamilyState } from '@/ui/layout/selectable-list/states/isSelectedItemIdComponentFamilyState';
import { useAtomComponentFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentFamilyStateValue';
import { useInitializeFilterOnFieldMetadataItemFromViewBarFilterDropdown } from '@/views/hooks/useInitializeFilterOnFieldMetadataItemFromViewBarFilterDropdown';
import { fieldMetadataItemIdUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemIdUsedInDropdownComponentState';
import { objectFilterDropdownSearchInputComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownSearchInputComponentState';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { useIcons } from 'twenty-ui/icon';

export type ViewBarFilterDropdownFieldSelectMenuItemProps = {
  fieldMetadataItemToSelect: FieldMetadataItem;
};

export const ViewBarFilterDropdownFieldSelectMenuItem = ({
  fieldMetadataItemToSelect,
}: ViewBarFilterDropdownFieldSelectMenuItemProps) => {
  const { resetSelectedItem } = useSelectableList();

  const isSelectedItemId = useAtomComponentFamilyStateValue(
    isSelectedItemIdComponentFamilyState,
    fieldMetadataItemToSelect.id,
  );

  const { initializeFilterOnFieldMetataItemFromViewBarFilterDropdown } =
    useInitializeFilterOnFieldMetadataItemFromViewBarFilterDropdown();

  const { getIcon } = useIcons();

  const Icon = getIcon(fieldMetadataItemToSelect.icon);

  const setFieldMetadataItemIdUsedInDropdown = useSetAtomComponentState(
    fieldMetadataItemIdUsedInDropdownComponentState,
  );
  const setObjectFilterDropdownSearchInput = useSetAtomComponentState(
    objectFilterDropdownSearchInputComponentState,
  );

  const handleClick = () => {
    resetSelectedItem();

    if (
      isManyToOneRelationField(fieldMetadataItemToSelect) ||
      isOneToManyRelationField(fieldMetadataItemToSelect)
    ) {
      // Fork: selecting a traversable relation field picks it in the dropdown
      // without selecting a concrete filter yet. The view-bar content then
      // derives the relation-target field list from these states (replacing the
      // deleted isSelectingRelationTargetField boolean).
      setFieldMetadataItemIdUsedInDropdown(fieldMetadataItemToSelect.id);
      setObjectFilterDropdownSearchInput('');
      return;
    }

    initializeFilterOnFieldMetataItemFromViewBarFilterDropdown(
      fieldMetadataItemToSelect,
    );
  };

  return (
    <SelectableListItem
      itemId={fieldMetadataItemToSelect.id}
      onEnter={handleClick}
    >
      <ListItem
        focused={isSelectedItemId}
        onClick={handleClick}
        startIcon={<SelectOptionIcon Icon={Icon} />}
        hasSubmenu={
          isManyToOneRelationField(fieldMetadataItemToSelect) ||
          isOneToManyRelationField(fieldMetadataItemToSelect)
        }
      >
        {fieldMetadataItemToSelect.label}
      </ListItem>
    </SelectableListItem>
  );
};
