import { Injectable } from '@nestjs/common';

import { type ObjectRecord } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { In } from 'typeorm';

import { getRecordDisplayName } from 'src/engine/core-modules/record-crud/utils/get-record-display-name.util';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { computeMorphOrRelationFieldJoinColumnName } from 'src/engine/metadata-modules/field-metadata/utils/compute-morph-or-relation-field-join-column-name.util';
import { type OrmFlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/orm-flat-field-metadata.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { getMinimalSelectForRecordIdentifier } from 'src/engine/metadata-modules/navigation-menu-item/utils/get-minimal-select-for-record-identifier.util';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';

@Injectable()
export class RecordLabelFormulaRelationService {
  constructor(private readonly workspaceOrmManager: WorkspaceOrmManager) {}

  async loadRelationRecordLabels({
    flatFieldMetadataMaps,
    flatObjectMetadataMaps,
    records,
    relationFieldMetadatas,
  }: {
    flatFieldMetadataMaps: FlatEntityMaps<OrmFlatFieldMetadata>;
    flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
    records: ObjectRecord[];
    relationFieldMetadatas: OrmFlatFieldMetadata[];
  }): Promise<Map<string, string>> {
    const relationRecordLabels = new Map<string, string>();
    // Display-name helpers are typed on the full field metadata but only read
    // keys the ORM projection carries, so the query-runner maps are safe here.
    const fullFlatFieldMetadataMaps =
      flatFieldMetadataMaps as unknown as FlatEntityMaps<FlatFieldMetadata>;
    const relationFieldsByTargetObjectId = new Map<
      string,
      OrmFlatFieldMetadata[]
    >();

    relationFieldMetadatas.forEach((fieldMetadata) => {
      if (!isDefined(fieldMetadata.relationTargetObjectMetadataId)) {
        return;
      }

      const existingFields =
        relationFieldsByTargetObjectId.get(
          fieldMetadata.relationTargetObjectMetadataId,
        ) ?? [];

      relationFieldsByTargetObjectId.set(
        fieldMetadata.relationTargetObjectMetadataId,
        [...existingFields, fieldMetadata],
      );
    });

    for (const [
      targetObjectMetadataId,
      relationFields,
    ] of relationFieldsByTargetObjectId) {
      const targetObjectMetadata = findFlatEntityByIdInFlatEntityMaps({
        flatEntityId: targetObjectMetadataId,
        flatEntityMaps: flatObjectMetadataMaps,
      });

      if (!isDefined(targetObjectMetadata)) {
        continue;
      }

      const targetRecordIds = new Set<string>();

      for (const relationField of relationFields) {
        const joinColumnName = computeMorphOrRelationFieldJoinColumnName({
          name: relationField.name,
        });

        records.forEach((record) => {
          const targetRecordId = record[joinColumnName];

          if (typeof targetRecordId === 'string') {
            targetRecordIds.add(targetRecordId);
          }
        });
      }

      if (targetRecordIds.size === 0) {
        continue;
      }

      const targetRepository = this.workspaceOrmManager.getRepository(
        targetObjectMetadata.nameSingular,
        { shouldBypassPermissionChecks: true },
      );
      const targetRecords = (await targetRepository.find({
        select: getMinimalSelectForRecordIdentifier({
          flatObjectMetadata: targetObjectMetadata,
          flatFieldMetadataMaps: fullFlatFieldMetadataMaps,
        }),
        where: { id: In([...targetRecordIds]) },
      })) as ObjectRecord[];

      targetRecords.forEach((targetRecord) => {
        relationRecordLabels.set(
          `${targetObjectMetadataId}:${targetRecord.id}`,
          getRecordDisplayName(
            targetRecord,
            targetObjectMetadata,
            fullFlatFieldMetadataMaps,
          ),
        );
      });
    }

    return relationRecordLabels;
  }
}
