import { isManyToOneRelationField } from '@/object-metadata/utils/isManyToOneRelationField';
import { isOneToManyRelationField } from '@/object-metadata/utils/isOneToManyRelationField';
import { fieldMetadataItemUsedInDropdownComponentSelector } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemUsedInDropdownComponentSelector';
import { objectFilterDropdownFilterIsSelectedComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownFilterIsSelectedComponentState';
import { useAtomComponentSelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentSelectorValue';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { isDefined } from 'twenty-shared/utils';

// Fork: upstream replaced the deleted
// objectFilterDropdownIsSelectingRelationTargetFieldComponentState boolean with
// Dropdown.Page navigation, which the legacy view-bar dropdown does not use.
// Derive the same "showing the relation-target field list" condition from the
// existing object-filter-dropdown states instead: a relation field is picked in
// the dropdown but no concrete filter has been selected on it yet.
export const useViewBarFilterDropdownIsSelectingRelationTargetField = () => {
  const fieldMetadataItemUsedInDropdown = useAtomComponentSelectorValue(
    fieldMetadataItemUsedInDropdownComponentSelector,
  );

  const objectFilterDropdownFilterIsSelected = useAtomComponentStateValue(
    objectFilterDropdownFilterIsSelectedComponentState,
  );

  const isTraversableRelationField =
    isDefined(fieldMetadataItemUsedInDropdown) &&
    (isManyToOneRelationField(fieldMetadataItemUsedInDropdown) ||
      isOneToManyRelationField(fieldMetadataItemUsedInDropdown));

  return (
    isTraversableRelationField && !objectFilterDropdownFilterIsSelected
  );
};
