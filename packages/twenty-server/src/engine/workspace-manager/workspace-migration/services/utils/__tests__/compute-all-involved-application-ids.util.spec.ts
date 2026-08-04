import { TWENTY_STANDARD_APPLICATION } from 'src/engine/workspace-manager/twenty-standard-application/constants/twenty-standard-applications';
import { computeAllInvolvedApplicationIds } from 'src/engine/workspace-manager/workspace-migration/services/utils/compute-all-involved-application-ids.util';

const CUSTOM_APPLICATION_ID = 'custom-application-id';
const CUSTOM_APPLICATION_UNIVERSAL_IDENTIFIER =
  '00000000-0000-4000-8000-000000000001';
const STANDARD_APPLICATION_ID = 'standard-application-id';
const APP_APPLICATION_ID = 'app-application-id';
const APP_APPLICATION_UNIVERSAL_IDENTIFIER =
  '00000000-0000-4000-8000-000000000002';
const VIEW_UNIVERSAL_IDENTIFIER = '00000000-0000-4000-8000-000000000003';
const FIELD_UNIVERSAL_IDENTIFIER = '00000000-0000-4000-8000-000000000004';
const OBJECT_UNIVERSAL_IDENTIFIER = '00000000-0000-4000-8000-000000000005';

const mapsFrom = (
  entities: {
    applicationId: string;
    id: string;
    universalIdentifier: string;
    [key: string]: unknown;
  }[],
) => ({
  byUniversalIdentifier: Object.fromEntries(
    entities.map((entity) => [entity.universalIdentifier, entity]),
  ),
  universalIdentifierById: Object.fromEntries(
    entities.map((entity) => [entity.id, entity.universalIdentifier]),
  ),
  universalIdentifiersByApplicationId: entities.reduce<
    Record<string, string[]>
  >((result, entity) => {
    result[entity.applicationId] = [
      ...(result[entity.applicationId] ?? []),
      entity.universalIdentifier,
    ];

    return result;
  }, {}),
});

describe('computeAllInvolvedApplicationIds', () => {
  it('includes the app owning an object indirectly referenced by a custom view field', () => {
    const applicationIds = computeAllInvolvedApplicationIds({
      applicationUniversalIdentifier: CUSTOM_APPLICATION_UNIVERSAL_IDENTIFIER,
      flatApplicationMaps: {
        byId: {},
        idByUniversalIdentifier: {
          [CUSTOM_APPLICATION_UNIVERSAL_IDENTIFIER]: CUSTOM_APPLICATION_ID,
          [TWENTY_STANDARD_APPLICATION.universalIdentifier]:
            STANDARD_APPLICATION_ID,
          [APP_APPLICATION_UNIVERSAL_IDENTIFIER]: APP_APPLICATION_ID,
        },
      },
      allFlatEntityOperationRecordByMetadataName: {
        viewField: {
          flatEntityToCreate: {
            [FIELD_UNIVERSAL_IDENTIFIER]: {
              applicationUniversalIdentifier:
                CUSTOM_APPLICATION_UNIVERSAL_IDENTIFIER,
              fieldMetadataUniversalIdentifier: FIELD_UNIVERSAL_IDENTIFIER,
              universalIdentifier: '00000000-0000-4000-8000-000000000006',
              viewFieldGroupUniversalIdentifier: null,
              viewUniversalIdentifier: VIEW_UNIVERSAL_IDENTIFIER,
            } as never,
          },
          flatEntityToDelete: {},
          flatEntityToUpdate: {},
        },
      },
      allRelatedFlatEntityMaps: {
        flatFieldMetadataMaps: mapsFrom([
          {
            applicationId: CUSTOM_APPLICATION_ID,
            applicationUniversalIdentifier:
              CUSTOM_APPLICATION_UNIVERSAL_IDENTIFIER,
            id: 'field-id',
            objectMetadataUniversalIdentifier: OBJECT_UNIVERSAL_IDENTIFIER,
            universalIdentifier: FIELD_UNIVERSAL_IDENTIFIER,
          },
        ]),
        flatObjectMetadataMaps: mapsFrom([
          {
            applicationId: APP_APPLICATION_ID,
            applicationUniversalIdentifier:
              APP_APPLICATION_UNIVERSAL_IDENTIFIER,
            id: 'object-id',
            universalIdentifier: OBJECT_UNIVERSAL_IDENTIFIER,
          },
        ]),
        flatViewMaps: mapsFrom([
          {
            applicationId: CUSTOM_APPLICATION_ID,
            applicationUniversalIdentifier:
              CUSTOM_APPLICATION_UNIVERSAL_IDENTIFIER,
            id: 'view-id',
            objectMetadataUniversalIdentifier: OBJECT_UNIVERSAL_IDENTIFIER,
            universalIdentifier: VIEW_UNIVERSAL_IDENTIFIER,
          },
        ]),
        flatViewFieldGroupMaps: mapsFrom([]),
      } as never,
    });

    expect(applicationIds).toEqual(
      expect.arrayContaining([
        CUSTOM_APPLICATION_ID,
        STANDARD_APPLICATION_ID,
        APP_APPLICATION_ID,
      ]),
    );
  });
});
