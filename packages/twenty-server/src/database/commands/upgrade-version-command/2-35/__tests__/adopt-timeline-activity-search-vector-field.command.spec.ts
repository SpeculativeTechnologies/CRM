import { getSearchFieldUniversalIdentifier } from 'twenty-shared/application';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { FieldMetadataType } from 'twenty-shared/types';

import { planTimelineActivitySearchVectorAdoption } from 'src/database/commands/upgrade-version-command/2-35/2-35-workspace-command-1787749299999-adopt-timeline-activity-search-vector-field.command';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type SyncableFlatEntity } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-from.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type FlatSearchFieldMetadata } from 'src/engine/metadata-modules/flat-search-field-metadata/types/flat-search-field-metadata.type';

const TIMELINE_ACTIVITY = STANDARD_OBJECTS.timelineActivity;
const OBJECT_ID = 'object-timeline-activity';
const APPLICATION_UNIVERSAL_IDENTIFIER =
  '20202020-64aa-4b6f-b003-9c74b97cee20';
const LEGACY_SEARCH_VECTOR_UNIVERSAL_IDENTIFIER = 'legacy-search-vector';

const buildMaps = <TEntity extends SyncableFlatEntity>(
  entities: TEntity[],
): FlatEntityMaps<TEntity> =>
  ({
    byUniversalIdentifier: Object.fromEntries(
      entities.map((entity) => [entity.universalIdentifier, entity]),
    ),
    universalIdentifierById: Object.fromEntries(
      entities.map((entity) => [entity.id, entity.universalIdentifier]),
    ),
    universalIdentifiersByApplicationId: {},
  }) as unknown as FlatEntityMaps<TEntity>;

const objectMetadata = {
  id: OBJECT_ID,
  universalIdentifier: TIMELINE_ACTIVITY.universalIdentifier,
  applicationId: 'application-id',
  applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
} as unknown as FlatObjectMetadata;

const linkedRecordCachedNameField = {
  id: 'field-linked-record-cached-name',
  universalIdentifier:
    TIMELINE_ACTIVITY.fields.linkedRecordCachedName.universalIdentifier,
  objectMetadataId: OBJECT_ID,
  name: 'linkedRecordCachedName',
  type: FieldMetadataType.TEXT,
} as unknown as FlatFieldMetadata;

const buildSearchVectorField = (universalIdentifier: string) =>
  ({
    id: 'field-search-vector',
    universalIdentifier,
    objectMetadataId: OBJECT_ID,
    name: 'searchVector',
    type: FieldMetadataType.TS_VECTOR,
    deletedAt: null,
  }) as unknown as FlatFieldMetadata;

const standardSearchRow = {
  id: 'search-row',
  universalIdentifier: getSearchFieldUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    fieldMetadataUniversalIdentifier:
      TIMELINE_ACTIVITY.fields.linkedRecordCachedName.universalIdentifier,
  }),
} as unknown as FlatSearchFieldMetadata;

describe('planTimelineActivitySearchVectorAdoption', () => {
  it('should adopt a legacy searchVector field and restore the missing search row', () => {
    const adoption = planTimelineActivitySearchVectorAdoption({
      flatObjectMetadataMaps: buildMaps([objectMetadata]),
      flatFieldMetadataMaps: buildMaps([
        linkedRecordCachedNameField,
        buildSearchVectorField(LEGACY_SEARCH_VECTOR_UNIVERSAL_IDENTIFIER),
      ]),
      flatSearchFieldMetadataMaps: buildMaps<FlatSearchFieldMetadata>([]),
    });

    expect(adoption?.fieldToAdopt?.universalIdentifier).toBe(
      LEGACY_SEARCH_VECTOR_UNIVERSAL_IDENTIFIER,
    );
    expect(adoption?.isSearchFieldMetadataMissing).toBe(true);
  });

  it('should do nothing when the metadata is already converged', () => {
    const adoption = planTimelineActivitySearchVectorAdoption({
      flatObjectMetadataMaps: buildMaps([objectMetadata]),
      flatFieldMetadataMaps: buildMaps([
        linkedRecordCachedNameField,
        buildSearchVectorField(
          TIMELINE_ACTIVITY.fields.searchVector.universalIdentifier,
        ),
      ]),
      flatSearchFieldMetadataMaps: buildMaps([standardSearchRow]),
    });

    expect(adoption).toBeNull();
  });

  it('should only restore the search row when the field already has the standard identifier', () => {
    const adoption = planTimelineActivitySearchVectorAdoption({
      flatObjectMetadataMaps: buildMaps([objectMetadata]),
      flatFieldMetadataMaps: buildMaps([
        linkedRecordCachedNameField,
        buildSearchVectorField(
          TIMELINE_ACTIVITY.fields.searchVector.universalIdentifier,
        ),
      ]),
      flatSearchFieldMetadataMaps: buildMaps<FlatSearchFieldMetadata>([]),
    });

    expect(adoption?.fieldToAdopt).toBeNull();
    expect(adoption?.isSearchFieldMetadataMissing).toBe(true);
  });

  it('should leave a workspace without any searchVector field to the upstream backfill', () => {
    const adoption = planTimelineActivitySearchVectorAdoption({
      flatObjectMetadataMaps: buildMaps([objectMetadata]),
      flatFieldMetadataMaps: buildMaps([linkedRecordCachedNameField]),
      flatSearchFieldMetadataMaps: buildMaps<FlatSearchFieldMetadata>([]),
    });

    expect(adoption).toBeNull();
  });

  it('should do nothing without the timelineActivity object', () => {
    const adoption = planTimelineActivitySearchVectorAdoption({
      flatObjectMetadataMaps: buildMaps<FlatObjectMetadata>([]),
      flatFieldMetadataMaps: buildMaps([linkedRecordCachedNameField]),
      flatSearchFieldMetadataMaps: buildMaps<FlatSearchFieldMetadata>([]),
    });

    expect(adoption).toBeNull();
  });
});
