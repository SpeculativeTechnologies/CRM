import { msg } from '@lingui/core/macro';
import { LINKED_FIELD_SUPPORTED_TYPES } from 'twenty-shared/constants';
import { FieldMetadataType, RelationType } from 'twenty-shared/types';
import { getLinkedFieldReference, isDefined } from 'twenty-shared/utils';

import { FieldMetadataExceptionCode } from 'src/engine/metadata-modules/field-metadata/field-metadata.exception';
import { findFlatEntityByUniversalIdentifier } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier.util';
import { type FlatFieldMetadataTypeValidationArgs } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata-type-validator.type';
import { type FlatFieldMetadataValidationError } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata-validation-error.type';

const invalidLinkedField = (
  message: string,
): FlatFieldMetadataValidationError[] => [
  {
    code: FieldMetadataExceptionCode.INVALID_FIELD_INPUT,
    message,
    userFriendlyMessage: msg`Choose an active field through a single Person relation. Linked fields are read-only and cannot have a default value or a unique constraint.`,
  },
];

export const validateLinkedFieldMetadata = ({
  flatEntityToValidate: field,
  optimisticFlatEntityMapsAndRelatedFlatEntityMaps: {
    flatFieldMetadataMaps,
    flatObjectMetadataMaps,
  },
}: FlatFieldMetadataTypeValidationArgs<FieldMetadataType>): FlatFieldMetadataValidationError[] => {
  if (
    !isDefined(field.universalSettings) ||
    !('linkedField' in field.universalSettings)
  ) {
    return [];
  }

  const reference = getLinkedFieldReference(field.universalSettings);

  if (!isDefined(reference)) {
    return invalidLinkedField('The linked field reference is malformed');
  }

  const relation = findFlatEntityByUniversalIdentifier({
    universalIdentifier: reference.relationFieldMetadataUniversalIdentifier,
    flatEntityMaps: flatFieldMetadataMaps,
  });
  const source = findFlatEntityByUniversalIdentifier({
    universalIdentifier: reference.sourceFieldMetadataUniversalIdentifier,
    flatEntityMaps: flatFieldMetadataMaps,
  });

  if (
    !isDefined(relation) ||
    !isDefined(source) ||
    !relation.isActive ||
    !source.isActive ||
    isDefined(getLinkedFieldReference(relation.universalSettings)) ||
    relation.type !== FieldMetadataType.RELATION ||
    !isDefined(relation.universalSettings) ||
    !('relationType' in relation.universalSettings) ||
    relation.universalSettings.relationType !== RelationType.MANY_TO_ONE ||
    relation.objectMetadataUniversalIdentifier !==
      field.objectMetadataUniversalIdentifier ||
    relation.relationTargetObjectMetadataUniversalIdentifier !==
      source.objectMetadataUniversalIdentifier
  ) {
    return invalidLinkedField(
      'The linked field must follow an active many-to-one relation to its source field',
    );
  }

  const sourceObject = findFlatEntityByUniversalIdentifier({
    universalIdentifier: source.objectMetadataUniversalIdentifier,
    flatEntityMaps: flatObjectMetadataMaps,
  });

  if (
    sourceObject?.nameSingular !== 'person' ||
    source.objectMetadataUniversalIdentifier ===
      field.objectMetadataUniversalIdentifier ||
    !LINKED_FIELD_SUPPORTED_TYPES.includes(source.type) ||
    isDefined(getLinkedFieldReference(source.universalSettings)) ||
    source.type !== field.type
  ) {
    return invalidLinkedField(
      'The linked field must use the type of a direct Person data field',
    );
  }

  if (source.type === FieldMetadataType.RELATION) {
    if (!isDefined(source.relationTargetObjectMetadataUniversalIdentifier)) {
      return invalidLinkedField(
        'The linked relation source has no target object',
      );
    }
    const target = findFlatEntityByUniversalIdentifier({
      universalIdentifier:
        source.relationTargetObjectMetadataUniversalIdentifier,
      flatEntityMaps: flatObjectMetadataMaps,
    });
    if (
      field.type !== FieldMetadataType.RELATION ||
      !isDefined(target) ||
      !target.isActive ||
      field.relationTargetObjectMetadataUniversalIdentifier !==
        source.relationTargetObjectMetadataUniversalIdentifier ||
      field.relationTargetFieldMetadataUniversalIdentifier !== null ||
      !isDefined(field.universalSettings) ||
      !('relationType' in field.universalSettings) ||
      !isDefined(source.universalSettings) ||
      !('relationType' in source.universalSettings) ||
      field.universalSettings.relationType !==
        source.universalSettings.relationType
    ) {
      return invalidLinkedField(
        'A linked relation must retain the source target and cardinality',
      );
    }
  }

  if (
    field.isUIEditable ||
    field.isUnique ||
    field.isNullable !== true ||
    field.defaultValue !== null
  ) {
    return invalidLinkedField(
      'Linked fields must be nullable and read-only, with no default or unique constraint',
    );
  }

  return [];
};
