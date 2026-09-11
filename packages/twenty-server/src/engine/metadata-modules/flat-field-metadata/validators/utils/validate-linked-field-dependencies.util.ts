import { msg } from '@lingui/core/macro';
import { getLinkedFieldReference, isDefined } from 'twenty-shared/utils';

import { FieldMetadataExceptionCode } from 'src/engine/metadata-modules/field-metadata/field-metadata.exception';
import { type FlatFieldMetadataValidationError } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata-validation-error.type';
import { type UniversalFlatFieldMetadata } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-field-metadata.type';
import { type UniversalFlatObjectMetadata } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-object-metadata.type';
import { type UniversalFlatEntityMaps } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-entity-maps.type';

export const validateLinkedFieldDependencies = ({
  before,
  after,
  fields,
  objects,
}: {
  before: UniversalFlatFieldMetadata;
  after?: UniversalFlatFieldMetadata;
  fields: UniversalFlatEntityMaps<UniversalFlatFieldMetadata>;
  objects: UniversalFlatEntityMaps<UniversalFlatObjectMetadata>;
}): FlatFieldMetadataValidationError[] => {
  const previousReference = getLinkedFieldReference(before.universalSettings);
  const nextReference = getLinkedFieldReference(after?.universalSettings);

  if (
    isDefined(after) &&
    (previousReference?.relationFieldMetadataUniversalIdentifier !==
      nextReference?.relationFieldMetadataUniversalIdentifier ||
      previousReference?.sourceFieldMetadataUniversalIdentifier !==
        nextReference?.sourceFieldMetadataUniversalIdentifier)
  ) {
    return [
      {
        code: FieldMetadataExceptionCode.FIELD_MUTATION_NOT_ALLOWED,
        message: 'An existing field cannot change its linked-field reference',
        userFriendlyMessage: msg`Create a new linked field to choose a different source. Existing fields cannot be converted to or from linked fields.`,
      },
    ];
  }

  const invalidatesDependents =
    !isDefined(after) ||
    !after.isActive ||
    after.type !== before.type ||
    after.relationTargetObjectMetadataUniversalIdentifier !==
      before.relationTargetObjectMetadataUniversalIdentifier ||
    after.relationTargetFieldMetadataUniversalIdentifier !==
      before.relationTargetFieldMetadataUniversalIdentifier ||
    (isDefined(after.universalSettings) &&
    'relationType' in after.universalSettings
      ? after.universalSettings.relationType
      : undefined) !==
      (isDefined(before.universalSettings) &&
      'relationType' in before.universalSettings
        ? before.universalSettings.relationType
        : undefined);

  if (!invalidatesDependents) {
    return [];
  }

  const dependent = Object.values(fields.byUniversalIdentifier).find(
    (field) => {
      if (
        !isDefined(field) ||
        !isDefined(
          objects.byUniversalIdentifier[
            field.objectMetadataUniversalIdentifier
          ],
        )
      ) {
        return false;
      }

      const reference = getLinkedFieldReference(field.universalSettings);

      return (
        reference?.sourceFieldMetadataUniversalIdentifier ===
          before.universalIdentifier ||
        reference?.relationFieldMetadataUniversalIdentifier ===
          before.universalIdentifier
      );
    },
  );

  return isDefined(dependent)
    ? [
        {
          code: FieldMetadataExceptionCode.FIELD_MUTATION_NOT_ALLOWED,
          message: `Field "${before.name}" is used by linked field "${dependent.name}"`,
          userFriendlyMessage: msg`Remove the linked fields that depend on this field before deleting, deactivating, or changing its type or relation.`,
        },
      ]
    : [];
};
