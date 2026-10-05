import { type ObjectPermissionsWithObjectMetadataId } from '@/object-metadata/types/ObjectPermissionsWithObjectMetadataId';
import { isRecordFieldReadOnly } from '@/object-record/read-only/utils/isRecordFieldReadOnly';
import { type FieldDefinition } from '@/object-record/record-field/ui/types/FieldDefinition';
import { type FieldRelationMetadata } from '@/object-record/record-field/ui/types/FieldMetadata';
import {
  FieldMetadataType,
  MetadataWritability,
  RelationType,
} from '~/generated-metadata/graphql';

const OBJECT_METADATA_ID = 'object-metadata-id';
const TARGET_OBJECT_METADATA_ID = 'target-object-metadata-id';
const FIELD_METADATA_ID = 'field-metadata-id';
const INVERSE_FIELD_METADATA_ID = 'inverse-field-metadata-id';

const buildObjectPermissions = (
  overrides: Partial<ObjectPermissionsWithObjectMetadataId> = {},
): ObjectPermissionsWithObjectMetadataId => ({
  objectMetadataId: OBJECT_METADATA_ID,
  canReadObjectRecords: true,
  canUpdateObjectRecords: true,
  canSoftDeleteObjectRecords: true,
  canDestroyObjectRecords: true,
  restrictedFields: {},
  rowLevelPermissionPredicates: [],
  rowLevelPermissionPredicateGroups: [],
  ...overrides,
});

const baseParams = {
  isRecordReadOnly: false,
  objectMetadataId: OBJECT_METADATA_ID,
  fieldMetadataItem: {
    id: FIELD_METADATA_ID,
    isUIEditable: true,
    writability: MetadataWritability.OPEN,
  },
  objectPermissionsByObjectMetadataId: {
    [OBJECT_METADATA_ID]: buildObjectPermissions(),
  },
};

// Fork-specific params exercise the system-object, linked-field and
// label-identifier-formula locks, which read `type`/`settings`.
const mockParams = {
  isRecordReadOnly: false,
  objectMetadataId: OBJECT_METADATA_ID,
  fieldMetadataItem: {
    id: FIELD_METADATA_ID,
    isUIEditable: true,
    type: FieldMetadataType.TEXT,
    writability: MetadataWritability.OPEN,
  },
  objectPermissionsByObjectMetadataId: {
    [OBJECT_METADATA_ID]: buildObjectPermissions(),
  },
};

const oneToManyFieldDefinition: FieldDefinition<FieldRelationMetadata> = {
  fieldMetadataId: FIELD_METADATA_ID,
  label: 'People',
  iconName: 'IconUsers',
  type: FieldMetadataType.RELATION,
  metadata: {
    fieldName: 'people',
    relationType: RelationType.ONE_TO_MANY,
    relationObjectMetadataId: TARGET_OBJECT_METADATA_ID,
    relationObjectMetadataNameSingular: 'person',
    relationObjectMetadataNamePlural: 'people',
    relationFieldMetadataId: INVERSE_FIELD_METADATA_ID,
    objectMetadataNameSingular: 'company',
    targetFieldMetadataName: 'company',
  },
};

describe('isRecordFieldReadOnly', () => {
  it('should return true when record is read-only', () => {
    expect(
      isRecordFieldReadOnly({ ...baseParams, isRecordReadOnly: true }),
    ).toBe(true);
  });

  it('should return true when object lacks update permissions', () => {
    expect(
      isRecordFieldReadOnly({
        ...baseParams,
        objectPermissionsByObjectMetadataId: {
          [OBJECT_METADATA_ID]: buildObjectPermissions({
            canUpdateObjectRecords: false,
          }),
        },
      }),
    ).toBe(true);
  });

  it('should return true when field is restricted by permissions', () => {
    expect(
      isRecordFieldReadOnly({
        ...baseParams,
        objectPermissionsByObjectMetadataId: {
          [OBJECT_METADATA_ID]: buildObjectPermissions({
            restrictedFields: { [FIELD_METADATA_ID]: { canUpdate: false } },
          }),
        },
      }),
    ).toBe(true);
  });

  it('should return false when the object has no permissions entry', () => {
    expect(
      isRecordFieldReadOnly({
        ...baseParams,
        objectPermissionsByObjectMetadataId: {},
      }),
    ).toBe(false);
  });

  it('should return true when field is marked as UI read-only', () => {
    expect(
      isRecordFieldReadOnly({
        ...baseParams,
        fieldMetadataItem: {
          ...baseParams.fieldMetadataItem,
          isUIEditable: false,
        },
      }),
    ).toBe(true);
  });

  it('should return false when all conditions allow editing', () => {
    expect(isRecordFieldReadOnly(baseParams)).toBe(false);
  });

  it('locks linked values even if older metadata still reports UI editability', () => {
    expect(
      isRecordFieldReadOnly({
        ...mockParams,
        fieldMetadataItem: {
          ...mockParams.fieldMetadataItem,
          settings: {
            linkedField: {
              relationFieldMetadataUniversalIdentifier: 'person-relation',
              sourceFieldMetadataUniversalIdentifier: 'job-title',
            },
          },
        },
      }),
    ).toBe(true);
  });

  it('should return true when the field is computed by a record label formula', () => {
    const result = isRecordFieldReadOnly({
      ...mockParams,
      fieldMetadataItem: {
        id: 'field-123',
        isUIEditable: true,
        type: FieldMetadataType.TEXT,
      },
      fieldDefinition: {
        type: FieldMetadataType.TEXT,
        iconName: 'IconAbc',
        fieldMetadataId: 'field-123',
        label: 'Name',
        metadata: {
          fieldName: 'name',
          placeHolder: 'Name',
          settings: {
            labelIdentifierFormula: {
              template: '{0}',
              fieldReferences: [
                {
                  fieldMetadataUniversalIdentifiers: ['source-field'],
                },
              ],
            },
          },
        },
      },
    });

    expect(result).toBe(true);
  });

  it('should return true when field is from the standard application on a system object', () => {
    const result = isRecordFieldReadOnly({
      ...mockParams,
      isSystemObject: true,
      isFieldFromStandardApplication: true,
    });

    expect(result).toBe(true);
  });

  it('should return false when field is not from the standard application on a system object', () => {
    const result = isRecordFieldReadOnly({
      ...mockParams,
      isSystemObject: true,
      isFieldFromStandardApplication: false,
    });

    expect(result).toBe(false);
  });

  it('should return true when field application is not resolved on a system object', () => {
    const result = isRecordFieldReadOnly({
      ...mockParams,
      isSystemObject: true,
    });

    expect(result).toBe(true);
  });

  it('should return false for a junction target field on a system object', () => {
    const result = isRecordFieldReadOnly({
      ...mockParams,
      isSystemObject: true,
      isFieldFromStandardApplication: true,
      fieldMetadataItem: {
        ...mockParams.fieldMetadataItem,
        type: FieldMetadataType.RELATION,
        settings: { junctionTargetFieldId: 'target-field-123' },
      },
    });

    expect(result).toBe(false);
  });

  it('should return true for a plain relation field on a system object', () => {
    const result = isRecordFieldReadOnly({
      ...mockParams,
      isSystemObject: true,
      isFieldFromStandardApplication: true,
      fieldMetadataItem: {
        ...mockParams.fieldMetadataItem,
        type: FieldMetadataType.RELATION,
        settings: { relationType: RelationType.ONE_TO_MANY },
      },
    });

    expect(result).toBe(true);
  });

  it('should keep a junction target field read-only when the record is read-only', () => {
    const result = isRecordFieldReadOnly({
      ...mockParams,
      isRecordReadOnly: true,
      isSystemObject: true,
      fieldMetadataItem: {
        ...mockParams.fieldMetadataItem,
        type: FieldMetadataType.RELATION,
        settings: { junctionTargetFieldId: 'target-field-123' },
      },
    });

    expect(result).toBe(true);
  });

  it('should return false when isSystemObject is not provided', () => {
    const result = isRecordFieldReadOnly({
      ...mockParams,
    });

    expect(result).toBe(false);
  });

  it('should return true when the field writability is SYSTEM', () => {
    expect(
      isRecordFieldReadOnly({
        ...baseParams,
        fieldMetadataItem: {
          ...baseParams.fieldMetadataItem,
          writability: MetadataWritability.SYSTEM,
        },
      }),
    ).toBe(true);
  });

  it('should return true when the field writability is APPLICATION', () => {
    expect(
      isRecordFieldReadOnly({
        ...baseParams,
        fieldMetadataItem: {
          ...baseParams.fieldMetadataItem,
          writability: MetadataWritability.APPLICATION,
        },
      }),
    ).toBe(true);
  });

  it('should treat a missing field writability as OPEN', () => {
    expect(
      isRecordFieldReadOnly({
        ...baseParams,
        fieldMetadataItem: {
          ...baseParams.fieldMetadataItem,
          writability: undefined,
        },
      }),
    ).toBe(false);
  });

  it('should return true for a one-to-many relation whose target object cannot be updated', () => {
    expect(
      isRecordFieldReadOnly({
        ...baseParams,
        fieldDefinition: oneToManyFieldDefinition,
        objectPermissionsByObjectMetadataId: {
          ...baseParams.objectPermissionsByObjectMetadataId,
          [TARGET_OBJECT_METADATA_ID]: buildObjectPermissions({
            objectMetadataId: TARGET_OBJECT_METADATA_ID,
            canUpdateObjectRecords: false,
          }),
        },
      }),
    ).toBe(true);
  });

  it('should return false for a one-to-many relation whose target object can be updated', () => {
    expect(
      isRecordFieldReadOnly({
        ...baseParams,
        fieldDefinition: oneToManyFieldDefinition,
        objectPermissionsByObjectMetadataId: {
          ...baseParams.objectPermissionsByObjectMetadataId,
          [TARGET_OBJECT_METADATA_ID]: buildObjectPermissions({
            objectMetadataId: TARGET_OBJECT_METADATA_ID,
          }),
        },
      }),
    ).toBe(false);
  });

  it('should return true for a one-to-many relation whose inverse field on the updatable target is update-restricted', () => {
    expect(
      isRecordFieldReadOnly({
        ...baseParams,
        fieldDefinition: oneToManyFieldDefinition,
        objectPermissionsByObjectMetadataId: {
          ...baseParams.objectPermissionsByObjectMetadataId,
          [TARGET_OBJECT_METADATA_ID]: buildObjectPermissions({
            objectMetadataId: TARGET_OBJECT_METADATA_ID,
            restrictedFields: {
              [INVERSE_FIELD_METADATA_ID]: { canUpdate: false },
            },
          }),
        },
      }),
    ).toBe(true);
  });
});
