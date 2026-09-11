import { getLinkedFieldReference, isDefined } from 'twenty-shared/utils';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type OrmFlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/orm-flat-field-metadata.type';

// A lookup never owns the source relation's unique inverse metadata reference.
export const getRelationTargetFieldMetadataId = (
  field: OrmFlatFieldMetadata,
  fields: FlatEntityMaps<OrmFlatFieldMetadata>,
): string | null => {
  const reference = getLinkedFieldReference(field.settings);
  if (!isDefined(reference)) {
    return field.relationTargetFieldMetadataId;
  }
  return (
    fields.byUniversalIdentifier[
      reference.sourceFieldMetadataUniversalIdentifier
    ]?.relationTargetFieldMetadataId ?? null
  );
};
