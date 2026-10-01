import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { FieldMetadataType, RelationType } from 'twenty-shared/types';

import { planTimelineActivityIndexAdoptions } from 'src/database/commands/upgrade-version-command/2-41/2-41-workspace-command-1789461461999-adopt-timeline-activity-message-campaign-indexes.command';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatIndexMetadata } from 'src/engine/metadata-modules/flat-index-metadata/types/flat-index-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { computeFlatIndexNameOrThrow } from 'src/engine/metadata-modules/index-metadata/utils/compute-flat-index-name.util';

const TIMELINE_ACTIVITY = STANDARD_OBJECTS.timelineActivity;
const MESSAGE_CAMPAIGN_FIELD =
  TIMELINE_ACTIVITY.fields.targetMessageCampaign.universalIdentifier;
const MESSAGE_LIST_FIELD =
  TIMELINE_ACTIVITY.fields.targetMessageList.universalIdentifier;
const MESSAGE_CAMPAIGN_INDEX =
  TIMELINE_ACTIVITY.indexes.messageCampaignIdIndex.universalIdentifier;

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

const timelineActivity = {
  universalIdentifier: TIMELINE_ACTIVITY.universalIdentifier,
  nameSingular: 'timelineActivity',
  namePlural: 'timelineActivities',
};

const buildRelationField = (universalIdentifier: string, name: string) => ({
  universalIdentifier,
  name,
  type: FieldMetadataType.RELATION,
  objectMetadataUniversalIdentifier: TIMELINE_ACTIVITY.universalIdentifier,
  universalSettings: { relationType: RelationType.MANY_TO_ONE },
});

const fields = [
  buildRelationField(MESSAGE_CAMPAIGN_FIELD, 'targetMessageCampaign'),
  buildRelationField(MESSAGE_LIST_FIELD, 'targetMessageList'),
];

const flatObjectMetadataMaps = buildMaps<FlatEntityMaps<FlatObjectMetadata>>([
  timelineActivity,
]);
const flatFieldMetadataMaps = buildMaps<FlatEntityMaps<FlatFieldMetadata>>(fields);

const nameOfIndexOn = (fieldUniversalIdentifier: string) =>
  computeFlatIndexNameOrThrow({
    flatObjectMetadata: timelineActivity as unknown as FlatObjectMetadata,
    objectFlatFieldMetadatas: fields as unknown as FlatFieldMetadata[],
    indexFields: [
      {
        fieldMetadataUniversalIdentifier: fieldUniversalIdentifier,
        order: 0,
        subFieldName: null,
      },
    ],
    isUnique: false,
    indexWhereClause: null,
  });

const buildIndex = (universalIdentifier: string, name: string) => ({
  id: `${universalIdentifier}-id`,
  universalIdentifier,
  name,
  objectMetadataUniversalIdentifier: TIMELINE_ACTIVITY.universalIdentifier,
});

describe('planTimelineActivityIndexAdoptions', () => {
  it('should adopt an existing index that carries the standard name under another identifier', () => {
    const adoptions = planTimelineActivityIndexAdoptions({
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatIndexMaps: buildMaps<FlatEntityMaps<FlatIndexMetadata>>([
        buildIndex('auto-created-index', nameOfIndexOn(MESSAGE_CAMPAIGN_FIELD)),
      ]),
    });

    expect(adoptions).toEqual([
      {
        indexId: 'auto-created-index-id',
        indexName: nameOfIndexOn(MESSAGE_CAMPAIGN_FIELD),
        standardIndexUniversalIdentifier: MESSAGE_CAMPAIGN_INDEX,
      },
    ]);
  });

  it('should leave a workspace whose index already has the standard identifier', () => {
    const adoptions = planTimelineActivityIndexAdoptions({
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatIndexMaps: buildMaps<FlatEntityMaps<FlatIndexMetadata>>([
        buildIndex(MESSAGE_CAMPAIGN_INDEX, nameOfIndexOn(MESSAGE_CAMPAIGN_FIELD)),
      ]),
    });

    expect(adoptions).toEqual([]);
  });

  it('should not adopt an unrelated index', () => {
    const adoptions = planTimelineActivityIndexAdoptions({
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatIndexMaps: buildMaps<FlatEntityMaps<FlatIndexMetadata>>([
        buildIndex('other-index', 'IDX_unrelated'),
      ]),
    });

    expect(adoptions).toEqual([]);
  });
});
