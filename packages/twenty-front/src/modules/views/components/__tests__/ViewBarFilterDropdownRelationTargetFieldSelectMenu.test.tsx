import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { isManyToOneRelationField } from '@/object-metadata/utils/isManyToOneRelationField';
import { isOneToManyRelationField } from '@/object-metadata/utils/isOneToManyRelationField';
import { ObjectFilterDropdownComponentInstanceContext } from '@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext';
import { objectFilterDropdownCurrentRecordFilterComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownCurrentRecordFilterComponentState';
import { objectFilterDropdownIsSelectingRelationTargetFieldComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownIsSelectingRelationTargetFieldComponentState';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { SelectableList } from '@/ui/layout/selectable-list/components/SelectableList';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { ViewBarFilterDropdownFieldSelectMenuItem } from '@/views/components/ViewBarFilterDropdownFieldSelectMenuItem';
import { ViewBarFilterDropdownRelationTargetFieldSelectMenu } from '@/views/components/ViewBarFilterDropdownRelationTargetFieldSelectMenu';
import { getJestMetadataAndApolloMocksWrapper } from '~/testing/jest/getJestMetadataAndApolloMocksWrapper';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';

const INSTANCE_ID = 'view-bar-relation-filter-test';
const opportunity = getMockObjectMetadataItemOrThrow('opportunity');
const relationFields = [
  opportunity.fields.find(
    (field) =>
      isManyToOneRelationField(field) &&
      field.relation.targetObjectMetadata.nameSingular === 'workspaceMember',
  ),
  opportunity.fields.find(
    (field) =>
      isManyToOneRelationField(field) &&
      field.relation.targetObjectMetadata.nameSingular === 'company',
  ),
  opportunity.fields.find(isOneToManyRelationField),
];

const FilterMenu = ({ field }: { field: FieldMetadataItem }) => {
  const objectFilterDropdownIsSelectingRelationTargetField =
    useAtomComponentStateValue(
      objectFilterDropdownIsSelectingRelationTargetFieldComponentState,
    );
  const objectFilterDropdownCurrentRecordFilter = useAtomComponentStateValue(
    objectFilterDropdownCurrentRecordFilterComponentState,
  );

  return (
    <>
      <Dropdown
        dropdownId={INSTANCE_ID}
        clickableComponent={<button>Filter</button>}
        dropdownComponents={
          objectFilterDropdownIsSelectingRelationTargetField ? (
            <ViewBarFilterDropdownRelationTargetFieldSelectMenu />
          ) : (
            <SelectableList
              focusId={INSTANCE_ID}
              selectableListInstanceId={INSTANCE_ID}
              selectableItemIdArray={[field.id]}
            >
              <ViewBarFilterDropdownFieldSelectMenuItem
                fieldMetadataItemToSelect={field}
              />
            </SelectableList>
          )
        }
      />
      <output aria-label="Selected filter">
        {JSON.stringify(objectFilterDropdownCurrentRecordFilter)}
      </output>
    </>
  );
};

const renderFilter = (field: FieldMetadataItem) => {
  const Wrapper = getJestMetadataAndApolloMocksWrapper({ apolloMocks: [] });

  render(
    <Wrapper>
      <ObjectFilterDropdownComponentInstanceContext.Provider
        value={{ instanceId: INSTANCE_ID }}
      >
        <FilterMenu field={field} />
      </ObjectFilterDropdownComponentInstanceContext.Provider>
    </Wrapper>,
  );
};

describe('View bar relation filters', () => {
  it.each(relationFields)(
    'should open the related record and field choices for $label',
    async (field) => {
      if (!field?.relation) {
        throw new Error('Missing expected relation field in opportunity mock');
      }

      const user = userEvent.setup();
      const target = getMockObjectMetadataItemOrThrow(
        field.relation.targetObjectMetadata.nameSingular,
      );
      renderFilter(field);

      await user.click(screen.getByText('Filter', { exact: true }));
      await user.click(await screen.findByText(field.label));
      expect(
        (await screen.findAllByText(target.labelSingular)).length,
      ).toBeGreaterThan(0);
      expect(screen.getByText('Creation date')).toBeVisible();
    },
  );

  it('should select an owner field from the relation submenu', async () => {
    const ownerField = relationFields[0];
    if (!ownerField) {
      throw new Error('Missing owner field in opportunity mock');
    }
    const user = userEvent.setup();
    renderFilter(ownerField);

    await user.click(screen.getByText('Filter', { exact: true }));
    await user.click(await screen.findByText(ownerField.label));
    await user.click(await screen.findByText('User Email'));

    expect(
      JSON.parse(screen.getByRole('status').textContent || '{}'),
    ).toMatchObject({
      fieldMetadataId: ownerField.id,
      type: 'TEXT',
    });
  });
});
