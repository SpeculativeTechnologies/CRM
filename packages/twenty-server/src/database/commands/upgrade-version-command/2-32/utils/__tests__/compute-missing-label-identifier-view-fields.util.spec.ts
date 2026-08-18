import { ViewType } from 'twenty-shared/types';

import { computeMissingLabelIdentifierViewFields } from 'src/database/commands/upgrade-version-command/2-32/utils/compute-missing-label-identifier-view-fields.util';
import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';

const NOW = '2026-08-17T00:00:00.000Z';

const LABEL_IDENTIFIER_BY_OBJECT_UNIVERSAL_IDENTIFIER = {
  'object-opportunity': {
    fieldMetadataId: 'field-name-id',
    fieldMetadataUniversalIdentifier: 'field-name',
  },
};

const buildFlatView = (overrides: Partial<FlatView> = {}): FlatView =>
  ({
    id: 'view-id',
    universalIdentifier: 'view',
    objectMetadataUniversalIdentifier: 'object-opportunity',
    applicationId: 'application-id',
    applicationUniversalIdentifier: 'application',
    workspaceId: 'workspace-id',
    type: ViewType.KANBAN,
    isSystemSideEffect: false,
    deletedAt: null,
    ...overrides,
  }) as FlatView;

const buildFlatViewField = (
  overrides: Partial<FlatViewField> = {},
): FlatViewField =>
  ({
    universalIdentifier: 'view-field-amount',
    fieldMetadataUniversalIdentifier: 'field-amount',
    position: 0,
    ...overrides,
  }) as FlatViewField;

const computeWithDefaults = ({
  flatViews,
  flatViewFieldsByViewUniversalIdentifier,
  excludedApplicationUniversalIdentifiers = [],
}: {
  flatViews: FlatView[];
  flatViewFieldsByViewUniversalIdentifier: Record<string, FlatViewField[]>;
  excludedApplicationUniversalIdentifiers?: string[];
}) =>
  computeMissingLabelIdentifierViewFields({
    flatViews,
    flatViewFieldsByViewUniversalIdentifier,
    labelIdentifierByObjectUniversalIdentifier:
      LABEL_IDENTIFIER_BY_OBJECT_UNIVERSAL_IDENTIFIER,
    excludedApplicationUniversalIdentifiers,
    ownerApplication: {
      id: 'custom-application-id',
      universalIdentifier: 'custom-application',
    },
    now: NOW,
    generateId: () => 'generated-id',
  });

describe('computeMissingLabelIdentifierViewFields', () => {
  it('should add the label identifier below the lowest existing column', () => {
    const viewFieldsToCreate = computeWithDefaults({
      flatViews: [buildFlatView()],
      flatViewFieldsByViewUniversalIdentifier: {
        view: [
          buildFlatViewField({ position: 0 }),
          buildFlatViewField({
            universalIdentifier: 'view-field-tier',
            fieldMetadataUniversalIdentifier: 'field-tier',
            position: 1,
          }),
        ],
      },
    });

    expect(viewFieldsToCreate).toHaveLength(1);
    expect(viewFieldsToCreate[0]).toMatchObject({
      applicationId: 'custom-application-id',
      applicationUniversalIdentifier: 'custom-application',
      viewId: 'view-id',
      viewUniversalIdentifier: 'view',
      fieldMetadataId: 'field-name-id',
      fieldMetadataUniversalIdentifier: 'field-name',
      position: -1,
      isVisible: true,
    });
  });

  it('should place the label identifier at 0 when the view has no column', () => {
    const viewFieldsToCreate = computeWithDefaults({
      flatViews: [buildFlatView()],
      flatViewFieldsByViewUniversalIdentifier: {},
    });

    expect(viewFieldsToCreate[0].position).toBe(0);
  });

  it('should skip views that already have their label identifier column', () => {
    expect(
      computeWithDefaults({
        flatViews: [buildFlatView()],
        flatViewFieldsByViewUniversalIdentifier: {
          view: [
            buildFlatViewField({
              universalIdentifier: 'view-field-name',
              fieldMetadataUniversalIdentifier: 'field-name',
            }),
          ],
        },
      }),
    ).toEqual([]);
  });

  it('should skip fields widget views', () => {
    expect(
      computeWithDefaults({
        flatViews: [buildFlatView({ type: ViewType.FIELDS_WIDGET })],
        flatViewFieldsByViewUniversalIdentifier: { view: [buildFlatViewField()] },
      }),
    ).toEqual([]);
  });

  it('should skip deleted views', () => {
    expect(
      computeWithDefaults({
        flatViews: [buildFlatView({ deletedAt: NOW })],
        flatViewFieldsByViewUniversalIdentifier: { view: [buildFlatViewField()] },
      }),
    ).toEqual([]);
  });

  it('should skip views of an excluded application', () => {
    expect(
      computeWithDefaults({
        flatViews: [buildFlatView()],
        flatViewFieldsByViewUniversalIdentifier: { view: [buildFlatViewField()] },
        excludedApplicationUniversalIdentifiers: ['application'],
      }),
    ).toEqual([]);
  });

  it('should skip views whose object has no resolvable label identifier', () => {
    expect(
      computeWithDefaults({
        flatViews: [
          buildFlatView({ objectMetadataUniversalIdentifier: 'object-unknown' }),
        ],
        flatViewFieldsByViewUniversalIdentifier: { view: [buildFlatViewField()] },
      }),
    ).toEqual([]);
  });
});
