import { compositeTypeDefinitions } from 'twenty-shared/types';
import { capitalize, isDefined } from 'twenty-shared/utils';

import { type WorkspaceInternalContext } from 'src/engine/twenty-orm/interfaces/workspace-internal-context.interface';

import { getFlatFieldsFromFlatObjectMetadata } from 'src/engine/api/graphql/workspace-schema-builder/utils/get-flat-fields-for-flat-object-metadata.util';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatIndexMetadata } from 'src/engine/metadata-modules/flat-index-metadata/types/flat-index-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type WorkspaceEntityManager } from 'src/engine/twenty-orm/entity-manager/workspace-entity-manager';

const getFieldMetadataIdsBackedByUniqueIndex = (
  objectMetadataId: string,
  flatIndexMaps: FlatEntityMaps<FlatIndexMetadata>,
): Set<string> => {
  const fieldMetadataIds = new Set<string>();

  for (const flatIndex of Object.values(flatIndexMaps.byUniversalIdentifier)) {
    if (
      !isDefined(flatIndex) ||
      !flatIndex.isUnique ||
      flatIndex.objectMetadataId !== objectMetadataId ||
      flatIndex.flatIndexFieldMetadatas.length !== 1
    ) {
      continue;
    }

    fieldMetadataIds.add(flatIndex.flatIndexFieldMetadatas[0].fieldMetadataId);
  }

  return fieldMetadataIds;
};

export const findConflictingRecord = async (
  columnName: string,
  conflictingValue: string,
  objectMetadata: FlatObjectMetadata,
  internalContext: WorkspaceInternalContext,
  entityManager: WorkspaceEntityManager,
): Promise<{ conflictingRecordId: string; fieldLabel: string } | null> => {
  const flatFields = getFlatFieldsFromFlatObjectMetadata(
    objectMetadata,
    internalContext.flatFieldMetadataMaps,
  );

  // field.isUnique only tracks unique indexes the engine owns as a field's
  // backing constraint, so a workspace whose index predates that flag reports
  // false while Postgres still rejects the write. Trust the index metadata too,
  // otherwise the user gets an unattributed "record already exists" with no way
  // to reach the record they collided with.
  const fieldMetadataIdsBackedByUniqueIndex =
    getFieldMetadataIdsBackedByUniqueIndex(
      objectMetadata.id,
      internalContext.flatIndexMaps,
    );

  const uniqueFields = flatFields.filter(
    (field) =>
      field.isUnique || fieldMetadataIdsBackedByUniqueIndex.has(field.id),
  );

  const matchingField = uniqueFields.find((field) => {
    const compositeType = compositeTypeDefinitions.get(field.type);

    if (!compositeType) {
      return field.name === columnName;
    }

    const property = compositeType.properties.find(
      (prop) => prop.isIncludedInUniqueConstraint,
    );

    if (!property) {
      return false;
    }

    const expectedColumnName = `${field.name}${capitalize(property.name)}`;

    return expectedColumnName === columnName;
  });

  if (!matchingField) {
    return null;
  }

  const queryBuilder = entityManager.createQueryBuilder(
    objectMetadata.nameSingular,
    objectMetadata.nameSingular,
    undefined,
    {
      shouldBypassPermissionChecks: true,
    },
  );

  queryBuilder.where(`"${columnName}" = :value`, { value: conflictingValue });
  queryBuilder.andWhere('"deletedAt" IS NULL');

  try {
    const conflictingRecord = await queryBuilder.getOne();

    if (!conflictingRecord) {
      return null;
    }

    return {
      conflictingRecordId: conflictingRecord.id,
      fieldLabel: matchingField.label,
    };
  } catch {
    // If query fails (e.g., permission denied, record not found), return null
    // This allows the duplicate error to still be shown without conflicting record link
    return null;
  }
};
