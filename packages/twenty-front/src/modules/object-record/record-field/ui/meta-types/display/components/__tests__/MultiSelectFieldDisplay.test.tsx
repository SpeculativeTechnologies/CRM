import { render, screen } from '@testing-library/react';

import { FieldContext } from '@/object-record/record-field/ui/contexts/FieldContext';
import { FieldFocusStaticUnfocusedProvider } from '@/object-record/record-field/ui/contexts/FieldFocusContextProvider';
import { MultiSelectFieldDisplay } from '@/object-record/record-field/ui/meta-types/display/components/MultiSelectFieldDisplay';
import { useMultiSelectFieldDisplay } from '@/object-record/record-field/ui/meta-types/hooks/useMultiSelectFieldDisplay';
import { FieldMetadataType } from '~/generated-metadata/graphql';

jest.mock(
  '@/object-record/record-field/ui/meta-types/hooks/useMultiSelectFieldDisplay',
);

const mockedUseMultiSelectFieldDisplay = jest.mocked(
  useMultiSelectFieldDisplay,
);

const renderMultiSelectFieldDisplay = (isInSidePanel: boolean) =>
  render(
    <FieldContext.Provider
      value={{
        recordId: 'record-id',
        isLabelIdentifier: false,
        isInSidePanel,
        isRecordFieldReadOnly: false,
        fieldDefinition: {
          fieldMetadataId: 'field-metadata-id',
          iconName: 'IconTags',
          label: 'Groups',
          type: FieldMetadataType.MULTI_SELECT,
          metadata: {
            fieldName: 'groups',
            options: [],
          },
        },
      }}
    >
      <FieldFocusStaticUnfocusedProvider>
        <MultiSelectFieldDisplay />
      </FieldFocusStaticUnfocusedProvider>
    </FieldContext.Provider>,
  );

describe('MultiSelectFieldDisplay', () => {
  beforeEach(() => {
    mockedUseMultiSelectFieldDisplay.mockReturnValue({
      fieldValue: ['prospects', 'people', 'mentors'],
      fieldDefinition: {
        fieldMetadataId: 'field-metadata-id',
        iconName: 'IconTags',
        label: 'Groups',
        type: FieldMetadataType.MULTI_SELECT,
        metadata: {
          fieldName: 'groups',
          options: [
            { value: 'prospects', label: 'Brains Prospects', color: 'gray' },
            { value: 'people', label: 'All People', color: 'gray' },
            { value: 'mentors', label: 'Brains Mentors', color: 'gray' },
          ],
        },
      },
    });
  });

  it('renders each selected option as a vertical list item in the side panel', () => {
    renderMultiSelectFieldDisplay(true);

    expect(screen.getByRole('list')).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Brains Prospects')).toBeVisible();
    expect(screen.getByText('All People')).toBeVisible();
    expect(screen.getByText('Brains Mentors')).toBeVisible();
  });

  it('keeps the compact inline display outside the side panel', () => {
    renderMultiSelectFieldDisplay(false);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText('Brains Prospects')).toBeVisible();
    expect(screen.getByText('All People')).toBeVisible();
    expect(screen.getByText('Brains Mentors')).toBeVisible();
  });
});
