import { type AllMetadataName } from 'twenty-shared/metadata';
import { isDefined } from 'twenty-shared/utils';

import { type FlatApplicationCacheMaps } from 'src/engine/core-modules/application/types/flat-application-cache-maps.type';
import { ALL_MANY_TO_ONE_METADATA_RELATIONS } from 'src/engine/metadata-modules/flat-entity/constant/all-many-to-one-metadata-relations.constant';
import {
  FlatEntityMapsException,
  FlatEntityMapsExceptionCode,
} from 'src/engine/metadata-modules/flat-entity/exceptions/flat-entity-maps.exception';
import { type AllFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/all-flat-entity-maps.type';
import { type AllFlatEntityOperationRecordByMetadataName } from 'src/engine/metadata-modules/flat-entity/types/all-flat-entity-operation-record-by-metadata-name.type';
import { getMetadataFlatEntityMapsKey } from 'src/engine/metadata-modules/flat-entity/utils/get-metadata-flat-entity-maps-key.util';
import { TWENTY_STANDARD_APPLICATION } from 'src/engine/workspace-manager/twenty-standard-application/constants/twenty-standard-applications';

type TraversableFlatEntity = {
  applicationId?: string;
  applicationUniversalIdentifier: string;
  universalIdentifier: string;
} & Record<string, unknown>;

type FlatEntityToVisit = {
  metadataName: AllMetadataName;
  flatEntity: TraversableFlatEntity;
};

export const computeAllInvolvedApplicationIds = ({
  allFlatEntityOperationRecordByMetadataName,
  flatApplicationMaps,
  applicationUniversalIdentifier,
  allRelatedFlatEntityMaps,
}: {
  allFlatEntityOperationRecordByMetadataName: AllFlatEntityOperationRecordByMetadataName;
  flatApplicationMaps: FlatApplicationCacheMaps;
  applicationUniversalIdentifier: string;
  allRelatedFlatEntityMaps: Partial<AllFlatEntityMaps>;
}): string[] => {
  const applicationIds = new Set<string>();
  const flatEntitiesToVisit: FlatEntityToVisit[] = [];
  const visitedFlatEntityKeys = new Set<string>();

  const applicationId =
    flatApplicationMaps.idByUniversalIdentifier[applicationUniversalIdentifier];

  const twentyStandardApplicationId =
    flatApplicationMaps.idByUniversalIdentifier[
      TWENTY_STANDARD_APPLICATION.universalIdentifier
    ];

  if (!isDefined(twentyStandardApplicationId)) {
    throw new FlatEntityMapsException(
      'Twenty standard application not found in workspace',
      FlatEntityMapsExceptionCode.ENTITY_NOT_FOUND,
    );
  }

  if (isDefined(applicationId)) {
    applicationIds.add(applicationId);
  }

  const isBuildingTwentyStandardApplication =
    applicationUniversalIdentifier ===
    TWENTY_STANDARD_APPLICATION.universalIdentifier;

  if (!isBuildingTwentyStandardApplication) {
    applicationIds.add(twentyStandardApplicationId);
  }

  for (const metadataName of Object.keys(
    allFlatEntityOperationRecordByMetadataName,
  ) as AllMetadataName[]) {
    const flatEntityOperations =
      allFlatEntityOperationRecordByMetadataName[metadataName];

    if (!isDefined(flatEntityOperations)) {
      continue;
    }

    for (const flatEntity of [
      ...Object.values(flatEntityOperations.flatEntityToCreate),
      ...Object.values(flatEntityOperations.flatEntityToUpdate),
      ...Object.values(flatEntityOperations.flatEntityToDelete),
    ]) {
      flatEntitiesToVisit.push({
        metadataName,
        flatEntity: flatEntity as unknown as TraversableFlatEntity,
      });
    }
  }

  while (flatEntitiesToVisit.length > 0) {
    const flatEntityToVisit = flatEntitiesToVisit.pop();

    if (!isDefined(flatEntityToVisit)) {
      continue;
    }

    const { metadataName, flatEntity } = flatEntityToVisit;
    const flatEntityKey = `${metadataName}:${flatEntity.universalIdentifier}`;

    if (visitedFlatEntityKeys.has(flatEntityKey)) {
      continue;
    }

    visitedFlatEntityKeys.add(flatEntityKey);

    const flatEntityApplicationId =
      flatEntity.applicationId ??
      flatApplicationMaps.idByUniversalIdentifier[
        flatEntity.applicationUniversalIdentifier
      ];

    if (isDefined(flatEntityApplicationId)) {
      applicationIds.add(flatEntityApplicationId);
    }

    const relations = ALL_MANY_TO_ONE_METADATA_RELATIONS[metadataName];

    for (const relation of Object.values(relations) as ({
      metadataName: AllMetadataName;
      universalForeignKey: string;
    } | null)[]) {
      if (!isDefined(relation)) {
        continue;
      }

      const referencedUniversalIdentifier =
        flatEntity[relation.universalForeignKey];

      if (typeof referencedUniversalIdentifier !== 'string') {
        continue;
      }

      const targetFlatEntityMaps =
        allRelatedFlatEntityMaps[
          getMetadataFlatEntityMapsKey(relation.metadataName)
        ];

      if (!isDefined(targetFlatEntityMaps)) {
        continue;
      }

      const referencedFlatEntity =
        targetFlatEntityMaps.byUniversalIdentifier[
          referencedUniversalIdentifier
        ];

      if (!isDefined(referencedFlatEntity)) {
        continue;
      }

      flatEntitiesToVisit.push({
        metadataName: relation.metadataName,
        flatEntity: referencedFlatEntity as unknown as TraversableFlatEntity,
      });
    }
  }

  return [...applicationIds];
};
