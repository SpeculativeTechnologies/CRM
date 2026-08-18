import { isNonEmptyString } from '@sniptt/guards';
import { type CreateViewFieldInput } from '~/generated-metadata/graphql';
import { computeLabelIdentifierViewFieldPosition } from '@/views/utils/computeLabelIdentifierViewFieldPosition';
import { ViewType } from '@/views/types/ViewType';

const LABEL_IDENTIFIER_VIEW_FIELD_SIZE = 150;

type ComputeViewFieldInputsForNewViewArgs = {
  copiedViewFieldInputs: CreateViewFieldInput[];
  labelIdentifierFieldMetadataId: string | null | undefined;
  viewType: ViewType;
  viewId: string;
  generateId: () => string;
};

// Kanban views draw their card titles from the label identifier without needing
// a view field for it, so copying their fields as-is leaves the new view with an
// arbitrary first column and no way to repair it: the server only accepts the
// label identifier strictly below every other column, while the UI appends new
// columns at the end.
export const computeViewFieldInputsForNewView = ({
  copiedViewFieldInputs,
  labelIdentifierFieldMetadataId,
  viewType,
  viewId,
  generateId,
}: ComputeViewFieldInputsForNewViewArgs): CreateViewFieldInput[] => {
  if (
    viewType === ViewType.FIELDS_WIDGET ||
    !isNonEmptyString(labelIdentifierFieldMetadataId) ||
    copiedViewFieldInputs.some(
      ({ fieldMetadataId }) =>
        fieldMetadataId === labelIdentifierFieldMetadataId,
    )
  ) {
    return copiedViewFieldInputs;
  }

  return [
    {
      id: generateId(),
      fieldMetadataId: labelIdentifierFieldMetadataId,
      position: computeLabelIdentifierViewFieldPosition(
        copiedViewFieldInputs.map(({ position }) => position ?? 0),
      ),
      isVisible: true,
      size: LABEL_IDENTIFIER_VIEW_FIELD_SIZE,
      viewId,
    },
    ...copiedViewFieldInputs,
  ];
};
