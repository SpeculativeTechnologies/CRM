import { ViewType } from '@/views/types/ViewType';
import { computeViewFieldInputsForNewView } from '@/views/utils/computeViewFieldInputsForNewView';

const LABEL_IDENTIFIER_FIELD_METADATA_ID = 'name-field-id';

const KANBAN_VIEW_FIELD_INPUTS = [
  {
    id: 'amount-view-field-id',
    fieldMetadataId: 'amount-field-id',
    position: 0,
    isVisible: true,
    size: 150,
    viewId: 'new-view-id',
  },
  {
    id: 'stage-view-field-id',
    fieldMetadataId: 'stage-field-id',
    position: 1,
    isVisible: true,
    size: 150,
    viewId: 'new-view-id',
  },
];

const computeWithDefaults = ({
  copiedViewFieldInputs,
  viewType = ViewType.TABLE,
  labelIdentifierFieldMetadataId = LABEL_IDENTIFIER_FIELD_METADATA_ID,
}: {
  copiedViewFieldInputs: typeof KANBAN_VIEW_FIELD_INPUTS;
  viewType?: ViewType;
  labelIdentifierFieldMetadataId?: string | null;
}) =>
  computeViewFieldInputsForNewView({
    copiedViewFieldInputs,
    labelIdentifierFieldMetadataId,
    viewType,
    viewId: 'new-view-id',
    generateId: () => 'generated-id',
  });

describe('computeViewFieldInputsForNewView', () => {
  it('should prepend the label identifier below the lowest copied position', () => {
    const viewFieldInputs = computeWithDefaults({
      copiedViewFieldInputs: KANBAN_VIEW_FIELD_INPUTS,
    });

    expect(viewFieldInputs).toHaveLength(3);
    expect(viewFieldInputs[0]).toEqual({
      id: 'generated-id',
      fieldMetadataId: LABEL_IDENTIFIER_FIELD_METADATA_ID,
      position: -1,
      isVisible: true,
      size: 150,
      viewId: 'new-view-id',
    });
    expect(viewFieldInputs.slice(1)).toEqual(KANBAN_VIEW_FIELD_INPUTS);
  });

  it('should leave the copied fields alone when they already contain the label identifier', () => {
    const copiedViewFieldInputs = [
      {
        ...KANBAN_VIEW_FIELD_INPUTS[0],
        fieldMetadataId: LABEL_IDENTIFIER_FIELD_METADATA_ID,
      },
      KANBAN_VIEW_FIELD_INPUTS[1],
    ];

    expect(computeWithDefaults({ copiedViewFieldInputs })).toEqual(
      copiedViewFieldInputs,
    );
  });

  it('should not add a label identifier to a fields widget view', () => {
    expect(
      computeWithDefaults({
        copiedViewFieldInputs: KANBAN_VIEW_FIELD_INPUTS,
        viewType: ViewType.FIELDS_WIDGET,
      }),
    ).toEqual(KANBAN_VIEW_FIELD_INPUTS);
  });

  it('should not add anything when the object has no label identifier', () => {
    expect(
      computeWithDefaults({
        copiedViewFieldInputs: KANBAN_VIEW_FIELD_INPUTS,
        labelIdentifierFieldMetadataId: null,
      }),
    ).toEqual(KANBAN_VIEW_FIELD_INPUTS);
  });

  it('should place the label identifier at 0 when there is nothing to copy', () => {
    expect(computeWithDefaults({ copiedViewFieldInputs: [] })).toEqual([
      {
        id: 'generated-id',
        fieldMetadataId: LABEL_IDENTIFIER_FIELD_METADATA_ID,
        position: 0,
        isVisible: true,
        size: 150,
        viewId: 'new-view-id',
      },
    ]);
  });
});
