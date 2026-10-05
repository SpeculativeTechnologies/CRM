import {
  checkIfFieldIsImageIdentifier,
  checkIfFieldIsLabelIdentifier,
} from 'twenty-shared/metadata';
import {
  FieldMetadataType,
  RelationType,
  type RestrictedFieldsPermissions,
  type ObjectPermissions,
  compositeTypeDefinitions,
} from 'twenty-shared/types';
import { getLinkedFieldReference, isDefined } from 'twenty-shared/utils';

import { computeMorphOrRelationFieldJoinColumnName } from 'src/engine/metadata-modules/field-metadata/utils/compute-morph-or-relation-field-join-column-name.util';
import { isCompositeFieldMetadataType } from 'src/engine/metadata-modules/field-metadata/utils/is-composite-field-metadata-type.util';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type OrmFlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/orm-flat-field-metadata.type';
import { isFlatFieldMetadataOfType } from 'src/engine/metadata-modules/flat-field-metadata/utils/is-flat-field-metadata-of-type.util';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

type SelectableFieldsStructured = Record<
  string,
  boolean | Record<string, boolean>
>;

export const buildFieldSelection = ({
  restrictedFields,
  objectsPermissions,
  flatObjectMetadata,
  flatFields,
  flatFieldMetadataMaps,
  onlyUseLabelIdentifierFieldsInRelations = false,
}: {
  restrictedFields: RestrictedFieldsPermissions;
  objectsPermissions?: Record<
    string,
    Pick<ObjectPermissions, 'canReadObjectRecords' | 'restrictedFields'>
  >;
  flatObjectMetadata: Pick<
    FlatObjectMetadata,
    | 'fieldIds'
    | 'nameSingular'
    | 'labelIdentifierFieldMetadataId'
    | 'imageIdentifierFieldMetadataId'
  >;
  flatFields: ReadonlyArray<
    Pick<
      OrmFlatFieldMetadata,
      | 'id'
      | 'universalIdentifier'
      | 'applicationId'
      | 'workspaceId'
      | 'type'
      | 'name'
      | 'settings'
    >
  >;
  flatFieldMetadataMaps: FlatEntityMaps<
    Pick<OrmFlatFieldMetadata, 'id' | 'objectMetadataId'>
  >;
  onlyUseLabelIdentifierFieldsInRelations?: boolean;
}): SelectableFieldsStructured => {
  const result: SelectableFieldsStructured = {};

  for (const flatField of flatFields) {
    if (restrictedFields[flatField.id]?.canRead === false) continue;

    const reference = getLinkedFieldReference(flatField.settings);
    if (
      isDefined(reference) &&
      ![
        reference.relationFieldMetadataUniversalIdentifier,
        reference.sourceFieldMetadataUniversalIdentifier,
      ].every((identifier) => {
        const source = flatFieldMetadataMaps.byUniversalIdentifier[identifier];
        if (!isDefined(source)) {
          return false;
        }
        const permissions = objectsPermissions?.[source.objectMetadataId];
        return (
          permissions?.canReadObjectRecords &&
          permissions.restrictedFields?.[source.id]?.canRead !== false
        );
      })
    ) {
      continue;
    }

    if (onlyUseLabelIdentifierFieldsInRelations) {
      const fieldIsLabelIdentifier = checkIfFieldIsLabelIdentifier(
        flatField,
        flatObjectMetadata,
      );
      const fieldIsImageIdentifier = checkIfFieldIsImageIdentifier(
        flatField,
        flatObjectMetadata,
      );
      const fieldIsIdField = flatField.name === 'id';

      if (
        !fieldIsLabelIdentifier &&
        !fieldIsImageIdentifier &&
        !fieldIsIdField
      ) {
        continue;
      }
    }

    if (isCompositeFieldMetadataType(flatField.type)) {
      const compositeType = compositeTypeDefinitions.get(flatField.type);

      if (!compositeType) {
        throw new Error(
          `Composite type definition not found for type: ${flatField.type}`,
        );
      }

      const compositeFields: Record<string, boolean> = {};

      for (const property of compositeType.properties) {
        compositeFields[property.name] = true;
      }

      result[flatField.name] = compositeFields;
    } else if (
      (isFlatFieldMetadataOfType(flatField, FieldMetadataType.RELATION) ||
        isFlatFieldMetadataOfType(
          flatField,
          FieldMetadataType.MORPH_RELATION,
        )) &&
      flatField.settings.relationType === RelationType.MANY_TO_ONE
    ) {
      const joinColumnName = computeMorphOrRelationFieldJoinColumnName({
        name: flatField.name,
      });

      result[joinColumnName] = true;
    } else {
      result[flatField.name] = true;
    }
  }

  return result;
};
