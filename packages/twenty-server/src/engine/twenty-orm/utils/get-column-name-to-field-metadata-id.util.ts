import {
  type CompositeType,
  FieldMetadataType,
  RelationType,
} from 'twenty-shared/types';
import { getLinkedFieldReference, isDefined } from 'twenty-shared/utils';

import { computeCompositeColumnName } from 'src/engine/metadata-modules/field-metadata/utils/compute-column-name.util';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type OrmFlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/orm-flat-field-metadata.type';
import { isFlatFieldMetadataOfType } from 'src/engine/metadata-modules/flat-field-metadata/utils/is-flat-field-metadata-of-type.util';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import {
  type ColumnNameProcessor,
  processFieldMetadataForColumnNameMapping,
} from 'src/engine/twenty-orm/utils/process-field-metadata-for-column-name-mapping.util';

export function getColumnNameToFieldMetadataIdMap(
  flatObjectMetadata: FlatObjectMetadata,
  flatFieldMetadataMaps: FlatEntityMaps<OrmFlatFieldMetadata>,
) {
  const columnNameToFieldMetadataIdMap: Record<string, string> = {};

  const processor: ColumnNameProcessor = {
    processCompositeField: ({
      fieldMetadataId,
      fieldMetadata,
      compositeType,
    }: {
      fieldMetadataId: string;
      fieldMetadata: OrmFlatFieldMetadata;
      compositeType: CompositeType;
    }) => {
      compositeType.properties.forEach((compositeProperty) => {
        const columnName = computeCompositeColumnName(
          fieldMetadata.name,
          compositeProperty,
        );

        columnNameToFieldMetadataIdMap[columnName] = fieldMetadataId;
      });
    },
    processRelationField: ({
      fieldMetadataId,
      joinColumnName,
      connectFieldName,
    }: {
      fieldMetadataId: string;
      joinColumnName: string;
      connectFieldName?: string;
    }) => {
      columnNameToFieldMetadataIdMap[joinColumnName] = fieldMetadataId;
      if (isDefined(connectFieldName)) {
        columnNameToFieldMetadataIdMap[connectFieldName] = fieldMetadataId;
      }
    },
    processSimpleField: ({
      fieldMetadataId,
      columnName,
    }: {
      fieldMetadataId: string;
      columnName: string;
    }) => {
      columnNameToFieldMetadataIdMap[columnName] = fieldMetadataId;
    },
  };

  processFieldMetadataForColumnNameMapping(
    flatObjectMetadata,
    flatFieldMetadataMaps,
    processor,
  );

  for (const field of Object.values(
    flatFieldMetadataMaps.byUniversalIdentifier,
  )) {
    if (
      !isDefined(field) ||
      field.objectMetadataId !== flatObjectMetadata.id ||
      !isFlatFieldMetadataOfType(field, FieldMetadataType.RELATION) ||
      field.settings.relationType !== RelationType.ONE_TO_MANY
    ) {
      continue;
    }
    // A to-many lookup reads a relation even though its Person key is virtual.
    columnNameToFieldMetadataIdMap[field.name] = field.id;
    if (isDefined(getLinkedFieldReference(field.settings))) {
      columnNameToFieldMetadataIdMap[`${field.name}Id`] = field.id;
    }
  }

  return columnNameToFieldMetadataIdMap;
}
