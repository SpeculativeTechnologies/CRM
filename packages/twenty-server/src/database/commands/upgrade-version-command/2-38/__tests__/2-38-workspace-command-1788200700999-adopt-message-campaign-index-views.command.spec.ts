import { STANDARD_OBJECTS } from 'twenty-shared/metadata';

import { type WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { AdoptMessageCampaignIndexViewsCommand } from 'src/database/commands/upgrade-version-command/2-38/2-38-workspace-command-1788200700999-adopt-message-campaign-index-views.command';
import { type ApplicationService } from 'src/engine/core-modules/application/application.service';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';
import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import { type WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';

const CAMPAIGN = STANDARD_OBJECTS.messageCampaign;
const STANDARD_VIEW_ID = 'standard-campaign-index-view';
const STANDARD_NAME_COLUMN_ID = 'standard-campaign-name-column';
const STANDARD_STATUS_COLUMN_ID = 'standard-campaign-status-column';

const buildMaps = <TMaps>(
  entities: ({ universalIdentifier: string; id?: string } & Record<
    string,
    unknown
  >)[],
): TMaps =>
  ({
    byUniversalIdentifier: Object.fromEntries(
      entities.map((entity) => [entity.universalIdentifier, entity]),
    ),
    universalIdentifierById: Object.fromEntries(
      entities
        .filter((entity) => entity.id !== undefined)
        .map((entity) => [entity.id as string, entity.universalIdentifier]),
    ),
    universalIdentifiersByApplicationId: {},
  }) as unknown as TMaps;

const standardFlatViewMaps = buildMaps<FlatEntityMaps<FlatView>>([
  {
    id: 'std-view',
    universalIdentifier: STANDARD_VIEW_ID,
    objectMetadataUniversalIdentifier: CAMPAIGN.universalIdentifier,
    key: 'INDEX',
  },
]);

const standardFlatViewFieldMaps = buildMaps<FlatEntityMaps<FlatViewField>>([
  {
    id: 'std-name-column',
    universalIdentifier: STANDARD_NAME_COLUMN_ID,
    viewUniversalIdentifier: STANDARD_VIEW_ID,
    fieldMetadataUniversalIdentifier: CAMPAIGN.fields.name.universalIdentifier,
  },
  {
    id: 'std-status-column',
    universalIdentifier: STANDARD_STATUS_COLUMN_ID,
    viewUniversalIdentifier: STANDARD_VIEW_ID,
    fieldMetadataUniversalIdentifier:
      CAMPAIGN.fields.status.universalIdentifier,
  },
]);

const flatObjectMetadataMaps = buildMaps<FlatEntityMaps<FlatObjectMetadata>>([
  {
    id: 'campaign-object',
    universalIdentifier: CAMPAIGN.universalIdentifier,
    nameSingular: 'messageCampaign',
  },
]);

const flatFieldMetadataMaps = buildMaps<FlatEntityMaps<FlatFieldMetadata>>([
  {
    id: 'name-field',
    universalIdentifier: CAMPAIGN.fields.name.universalIdentifier,
  },
  {
    id: 'status-field',
    universalIdentifier: CAMPAIGN.fields.status.universalIdentifier,
  },
  { id: 'custom-field', universalIdentifier: 'custom-field-universal-id' },
]);

const buildCommand = () =>
  new AdoptMessageCampaignIndexViewsCommand(
    {} as WorkspaceIteratorService,
    {} as unknown as ApplicationService,
    {} as unknown as WorkspaceCacheService,
  );

describe('AdoptMessageCampaignIndexViewsCommand.planAdoptions', () => {
  it('adopts the oldest existing index view and re-identifies the columns it shares with the standard view', () => {
    const adoptions = buildCommand().planAdoptions({
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatViewMaps: buildMaps<FlatEntityMaps<FlatView>>([
        {
          id: 'newer-view',
          universalIdentifier: 'auto-generated-newer',
          objectMetadataId: 'campaign-object',
          key: 'INDEX',
          createdAt: '2026-08-02T00:00:00.000Z',
          deletedAt: null,
        },
        {
          id: 'older-view',
          universalIdentifier: 'auto-generated-older',
          objectMetadataId: 'campaign-object',
          key: 'INDEX',
          createdAt: '2026-07-01T00:00:00.000Z',
          deletedAt: null,
        },
      ]),
      flatViewFieldMaps: buildMaps<FlatEntityMaps<FlatViewField>>([
        {
          id: 'existing-name-column',
          universalIdentifier: 'auto-generated-name-column',
          viewId: 'older-view',
          fieldMetadataId: 'name-field',
          deletedAt: null,
        },
        {
          id: 'existing-custom-column',
          universalIdentifier: 'auto-generated-custom-column',
          viewId: 'older-view',
          fieldMetadataId: 'custom-field',
          deletedAt: null,
        },
      ]),
      standardFlatViewMaps,
      standardFlatViewFieldMaps,
    });

    expect(adoptions).toEqual([
      {
        objectNameSingular: 'messageCampaign',
        viewId: 'older-view',
        standardViewUniversalIdentifier: STANDARD_VIEW_ID,
        viewFields: [
          {
            viewFieldId: 'existing-name-column',
            standardViewFieldUniversalIdentifier: STANDARD_NAME_COLUMN_ID,
          },
        ],
      },
    ]);
  });

  it('does nothing when the standard index view already exists', () => {
    const adoptions = buildCommand().planAdoptions({
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatViewMaps: buildMaps<FlatEntityMaps<FlatView>>([
        {
          id: 'std-view',
          universalIdentifier: STANDARD_VIEW_ID,
          objectMetadataId: 'campaign-object',
          key: 'INDEX',
          createdAt: '2026-07-01T00:00:00.000Z',
          deletedAt: null,
        },
      ]),
      flatViewFieldMaps: buildMaps<FlatEntityMaps<FlatViewField>>([]),
      standardFlatViewMaps,
      standardFlatViewFieldMaps,
    });

    expect(adoptions).toEqual([]);
  });

  it('does nothing when the object has no index view or does not exist', () => {
    const command = buildCommand();

    expect(
      command.planAdoptions({
        flatObjectMetadataMaps,
        flatFieldMetadataMaps,
        flatViewMaps: buildMaps<FlatEntityMaps<FlatView>>([
          {
            id: 'deleted-view',
            universalIdentifier: 'auto-generated-deleted',
            objectMetadataId: 'campaign-object',
            key: 'INDEX',
            createdAt: '2026-07-01T00:00:00.000Z',
            deletedAt: '2026-08-01T00:00:00.000Z',
          },
        ]),
        flatViewFieldMaps: buildMaps<FlatEntityMaps<FlatViewField>>([]),
        standardFlatViewMaps,
        standardFlatViewFieldMaps,
      }),
    ).toEqual([]);

    expect(
      command.planAdoptions({
        flatObjectMetadataMaps: buildMaps<FlatEntityMaps<FlatObjectMetadata>>([]),
        flatFieldMetadataMaps,
        flatViewMaps: buildMaps<FlatEntityMaps<FlatView>>([]),
        flatViewFieldMaps: buildMaps<FlatEntityMaps<FlatViewField>>([]),
        standardFlatViewMaps,
        standardFlatViewFieldMaps,
      }),
    ).toEqual([]);
  });
});
