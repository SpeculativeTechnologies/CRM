import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { type ObjectPermissionsByObjectMetadataId } from '@/object-metadata/types/ObjectPermissionsByObjectMetadataId';
import { getFieldPermissions } from '@/object-metadata/utils/getFieldPermissions';
import { getObjectPermissionsForObject } from '@/object-metadata/utils/getObjectPermissionsForObject';
import { isMetadataWritabilityRestricted } from '@/object-record/read-only/utils/internal/isMetadataWritabilityRestricted';
import { isOneToManyRelationFieldReadOnlyDueToTargetUpdatePermission } from '@/object-record/read-only/utils/isOneToManyRelationFieldReadOnlyDueToTargetUpdatePermission';
import { isConfiguredJunctionRelationField } from '@/object-record/record-field/ui/utils/junction/isConfiguredJunctionRelationField';
import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import {
  type FieldMetadata,
  type FieldTextMetadata,
} from '@/object-record/record-field/ui/types/FieldMetadata';
import { FieldMetadataType } from '~/generated-metadata/graphql';
import { getLinkedFieldReference, isDefined } from 'twenty-shared/utils';

type IsRecordFieldReadOnlyParams = {
  isRecordReadOnly: boolean;
  objectMetadataId: string;
  isSystemObject?: boolean;
  isFieldFromStandardApplication?: boolean;
  fieldMetadataItem: Pick<FieldMetadataItem, 'id' | 'isUIEditable' | 'writability'> &
    Partial<Pick<FieldMetadataItem, 'type' | 'settings'>>;
  objectPermissionsByObjectMetadataId: ObjectPermissionsByObjectMetadataId;
  fieldDefinition?: FieldDefinition<FieldMetadata>;
};

export const isRecordFieldReadOnly = ({
  isRecordReadOnly,
  objectMetadataId,
  isSystemObject,
  isFieldFromStandardApplication,
  fieldMetadataItem,
  objectPermissionsByObjectMetadataId,
  fieldDefinition,
}: IsRecordFieldReadOnlyParams) => {
  // A junction target field carries links the workspace owns, not data synced
  // from the provider, so it is exempt from the system-object lock below.
  // Record-level read-only still wins.
  const isJunctionTargetField =
    isDefined(fieldMetadataItem.type) &&
    isConfiguredJunctionRelationField({
      type: fieldMetadataItem.type,
      settings: fieldMetadataItem.settings,
    });

  // Keep system-object standard fields read-only. If the application origin
  // cannot be resolved yet, fail closed until metadata finishes loading.
  const isReadOnlyStandardFieldOnSystemObject =
    isSystemObject === true &&
    isFieldFromStandardApplication !== false &&
    !isJunctionTargetField;

  const isLabelIdentifierComputedByFormula =
    fieldDefinition?.type === FieldMetadataType.TEXT &&
    isDefined(
      (fieldDefinition.metadata as FieldTextMetadata).settings
        ?.labelIdentifierFormula,
    );

  if (
    isRecordReadOnly ||
    isDefined(getLinkedFieldReference(fieldMetadataItem.settings)) ||
    isLabelIdentifierComputedByFormula ||
    isReadOnlyStandardFieldOnSystemObject ||
    !(fieldMetadataItem.isUIEditable ?? true) ||
    isMetadataWritabilityRestricted(fieldMetadataItem.writability)
  ) {
    return true;
  }

  const objectPermissions = getObjectPermissionsForObject(
    objectPermissionsByObjectMetadataId,
    objectMetadataId,
  );

  if (
    !objectPermissions.canUpdateObjectRecords ||
    !getFieldPermissions({
      objectPermissions,
      fieldMetadataId: fieldMetadataItem.id,
    }).canUpdateField
  ) {
    return true;
  }

  return (
    isDefined(fieldDefinition) &&
    isOneToManyRelationFieldReadOnlyDueToTargetUpdatePermission({
      fieldDefinition,
      objectPermissionsByObjectMetadataId,
    })
  );
};
