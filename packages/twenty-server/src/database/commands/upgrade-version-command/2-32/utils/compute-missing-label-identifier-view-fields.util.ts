import { ViewType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';

const LABEL_IDENTIFIER_VIEW_FIELD_SIZE = 150;

type LabelIdentifierByObjectUniversalIdentifier = Record<
  string,
  { fieldMetadataId: string; fieldMetadataUniversalIdentifier: string }
>;

type ComputeMissingLabelIdentifierViewFieldsArgs = {
  flatViews: FlatView[];
  flatViewFieldsByViewUniversalIdentifier: Record<string, FlatViewField[]>;
  labelIdentifierByObjectUniversalIdentifier: LabelIdentifierByObjectUniversalIdentifier;
  excludedApplicationUniversalIdentifiers: string[];
  // View fields added outside of an application's own definition belong to the
  // workspace custom application, which is where the UI puts them too.
  ownerApplication: { id: string; universalIdentifier: string };
  now: string;
  generateId: () => string;
};

// A view without a view field for its object's label identifier renders an
// arbitrary first column, and the UI cannot repair it: the server requires the
// label identifier view field to sit strictly below every other one, while the
// UI only ever appends columns at the end. Kanban views used to be persisted
// that way, and copying one into a new table view carried the gap over.
export const computeMissingLabelIdentifierViewFields = ({
  flatViews,
  flatViewFieldsByViewUniversalIdentifier,
  labelIdentifierByObjectUniversalIdentifier,
  excludedApplicationUniversalIdentifiers,
  ownerApplication,
  now,
  generateId,
}: ComputeMissingLabelIdentifierViewFieldsArgs): FlatViewField[] =>
  flatViews.flatMap((flatView) => {
    if (
      flatView.type === ViewType.FIELDS_WIDGET ||
      isDefined(flatView.deletedAt) ||
      excludedApplicationUniversalIdentifiers.includes(
        flatView.applicationUniversalIdentifier,
      )
    ) {
      return [];
    }

    const labelIdentifier =
      labelIdentifierByObjectUniversalIdentifier[
        flatView.objectMetadataUniversalIdentifier
      ];

    if (!isDefined(labelIdentifier)) {
      return [];
    }

    const existingViewFields =
      flatViewFieldsByViewUniversalIdentifier[flatView.universalIdentifier] ??
      [];

    const hasLabelIdentifierViewField = existingViewFields.some(
      (flatViewField) =>
        flatViewField.fieldMetadataUniversalIdentifier ===
        labelIdentifier.fieldMetadataUniversalIdentifier,
    );

    if (hasLabelIdentifierViewField) {
      return [];
    }

    const positions = existingViewFields.map(({ position }) => position);

    return [
      {
        id: generateId(),
        universalIdentifier: generateId(),
        applicationId: ownerApplication.id,
        applicationUniversalIdentifier: ownerApplication.universalIdentifier,
        workspaceId: flatView.workspaceId,
        viewId: flatView.id,
        viewUniversalIdentifier: flatView.universalIdentifier,
        fieldMetadataId: labelIdentifier.fieldMetadataId,
        fieldMetadataUniversalIdentifier:
          labelIdentifier.fieldMetadataUniversalIdentifier,
        viewFieldGroupId: null,
        viewFieldGroupUniversalIdentifier: null,
        position: positions.length === 0 ? 0 : Math.min(...positions) - 1,
        isVisible: true,
        size: LABEL_IDENTIFIER_VIEW_FIELD_SIZE,
        aggregateOperation: null,
        isActive: true,
        isSystemSideEffect: flatView.isSystemSideEffect,
        overrides: null,
        universalOverrides: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ];
  });
