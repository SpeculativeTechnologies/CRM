import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { ViewType } from 'twenty-shared/types';

import { planMessageCampaignLabelIdentifierMove } from 'src/database/commands/upgrade-version-command/2-40/2-40-workspace-command-1788957151734-move-message-campaign-label-identifier-to-name.command';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';
import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';

const CAMPAIGN = STANDARD_OBJECTS.messageCampaign;
const NAME = CAMPAIGN.fields.name.universalIdentifier;
const SUBJECT = CAMPAIGN.fields.subject.universalIdentifier;
const STATUS = CAMPAIGN.fields.status.universalIdentifier;

const buildMaps = <TMaps>(
  entities: ({ universalIdentifier: string } & Record<string, unknown>)[],
): TMaps =>
  ({
    byUniversalIdentifier: Object.fromEntries(
      entities.map((entity) => [entity.universalIdentifier, entity]),
    ),
    universalIdentifierById: {},
    universalIdentifiersByApplicationId: {},
  }) as unknown as TMaps;

const buildObjectMaps = (labelIdentifier: string | null) =>
  buildMaps<FlatEntityMaps<FlatObjectMetadata>>([
    {
      universalIdentifier: CAMPAIGN.universalIdentifier,
      labelIdentifierFieldMetadataUniversalIdentifier: labelIdentifier,
    },
  ]);

const flatFieldMetadataMaps = buildMaps<FlatEntityMaps<FlatFieldMetadata>>([
  { universalIdentifier: NAME },
  { universalIdentifier: SUBJECT },
  { universalIdentifier: STATUS },
]);

const buildView = (
  universalIdentifier: string,
  type: ViewType,
  viewFieldUniversalIdentifiers: string[],
) => ({
  universalIdentifier,
  type,
  objectMetadataUniversalIdentifier: CAMPAIGN.universalIdentifier,
  viewFieldUniversalIdentifiers,
  deletedAt: null,
});

const buildViewField = (
  universalIdentifier: string,
  fieldMetadataUniversalIdentifier: string,
  position: number,
) => ({
  universalIdentifier,
  fieldMetadataUniversalIdentifier,
  position,
  deletedAt: null,
});

const flatViewMaps = buildMaps<FlatEntityMaps<FlatView>>([
  buildView('index-view', ViewType.TABLE, [
    'index-name',
    'index-subject',
    'index-status',
  ]),
  buildView('fields-widget-view', ViewType.FIELDS_WIDGET, [
    'widget-name',
    'widget-status',
  ]),
]);

const buildViewFieldMaps = (namePosition: number) =>
  buildMaps<FlatEntityMaps<FlatViewField>>([
    buildViewField('index-name', NAME, namePosition),
    buildViewField('index-subject', SUBJECT, 0),
    buildViewField('index-status', STATUS, 2),
    buildViewField('widget-name', NAME, 3),
    buildViewField('widget-status', STATUS, 0),
  ]);

describe('planMessageCampaignLabelIdentifierMove', () => {
  it('should repoint the label to name and move name strictly first when subject is the label', () => {
    const plan = planMessageCampaignLabelIdentifierMove({
      flatObjectMetadataMaps: buildObjectMaps(SUBJECT),
      flatFieldMetadataMaps,
      flatViewMaps,
      flatViewFieldMaps: buildViewFieldMaps(0),
    });

    expect(
      plan.objectMetadataToUpdate
        ?.labelIdentifierFieldMetadataUniversalIdentifier,
    ).toBe(NAME);
    expect(
      plan.viewFieldsToUpdate.map(({ universalIdentifier, position }) => ({
        universalIdentifier,
        position,
      })),
    ).toEqual([{ universalIdentifier: 'index-name', position: -1 }]);
  });

  it('should leave a label identifier a user chose', () => {
    const plan = planMessageCampaignLabelIdentifierMove({
      flatObjectMetadataMaps: buildObjectMaps(STATUS),
      flatFieldMetadataMaps,
      flatViewMaps,
      flatViewFieldMaps: buildViewFieldMaps(0),
    });

    expect(plan).toEqual({
      objectMetadataToUpdate: null,
      viewFieldsToUpdate: [],
    });
  });

  it('should do nothing when name is already the label and already first', () => {
    const plan = planMessageCampaignLabelIdentifierMove({
      flatObjectMetadataMaps: buildObjectMaps(NAME),
      flatFieldMetadataMaps,
      flatViewMaps,
      flatViewFieldMaps: buildViewFieldMaps(-1),
    });

    expect(plan).toEqual({
      objectMetadataToUpdate: null,
      viewFieldsToUpdate: [],
    });
  });

  it('should still move name first when the label was repointed but the column was not', () => {
    const plan = planMessageCampaignLabelIdentifierMove({
      flatObjectMetadataMaps: buildObjectMaps(NAME),
      flatFieldMetadataMaps,
      flatViewMaps,
      flatViewFieldMaps: buildViewFieldMaps(0),
    });

    expect(plan.objectMetadataToUpdate).toBeNull();
    expect(
      plan.viewFieldsToUpdate.map(({ universalIdentifier }) => universalIdentifier),
    ).toEqual(['index-name']);
  });
});
