import { FieldMetadataType, RelationType } from 'twenty-shared/types';
import { type FlatApplication } from 'src/engine/core-modules/application/types/flat-application.type';
import { fromCreateFieldInputToFlatFieldMetadatasToCreate } from 'src/engine/metadata-modules/flat-field-metadata/utils/from-create-field-input-to-flat-field-metadatas-to-create.util';
import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { getFlatObjectMetadataMock } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/get-flat-object-metadata.mock';
import { createEmptyFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/constant/create-empty-flat-entity-maps.constant';
import { validateLinkedFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/validators/utils/validate-linked-field-metadata.util';
import { validateLinkedFieldDependencies } from 'src/engine/metadata-modules/flat-field-metadata/validators/utils/validate-linked-field-dependencies.util';
import { type UniversalFlatFieldMetadata } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-field-metadata.type';
import { generateColumnDefinitions } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/generate-column-definitions.util';
import {
  collectEnumOperationsForField,
  EnumOperation,
} from 'src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/workspace-schema-enum-operations.util';

const setup = () => {
  const destination = getFlatObjectMetadataMock({
    universalIdentifier: 'recruitment',
    id: 'recruitment',
    nameSingular: 'recruitment',
  });
  const person = getFlatObjectMetadataMock({
    universalIdentifier: 'person',
    id: 'person',
    nameSingular: 'person',
  });
  const source = getFlatFieldMetadataMock({
    universalIdentifier: 'source',
    objectMetadataId: 'person',
    objectMetadataUniversalIdentifier: 'person',
    type: FieldMetadataType.TEXT,
    name: 'jobTitle',
  });
  const relation = getFlatFieldMetadataMock({
    universalIdentifier: 'relation',
    objectMetadataId: 'recruitment',
    objectMetadataUniversalIdentifier: 'recruitment',
    type: FieldMetadataType.RELATION,
    name: 'person',
    relationTargetObjectMetadataUniversalIdentifier: 'person',
    universalSettings: { relationType: RelationType.MANY_TO_ONE },
  });
  const settings = {
    linkedField: {
      relationFieldMetadataUniversalIdentifier: 'relation',
      sourceFieldMetadataUniversalIdentifier: 'source',
    },
  };
  const linked = getFlatFieldMetadataMock({
    universalIdentifier: 'linked',
    objectMetadataId: 'recruitment',
    objectMetadataUniversalIdentifier: 'recruitment',
    type: FieldMetadataType.TEXT,
    name: 'linkedJobTitle',
    settings,
    universalSettings: settings,
    isUIEditable: false,
  });
  const fields = {
    ...createEmptyFlatEntityMaps(),
    byUniversalIdentifier: { source, relation, linked },
  };
  const objects = {
    ...createEmptyFlatEntityMaps(),
    byUniversalIdentifier: { person, recruitment: destination },
  };
  const args = {
    flatEntityToValidate: linked,
    optimisticFlatEntityMapsAndRelatedFlatEntityMaps: {
      flatFieldMetadataMaps: fields,
      flatObjectMetadataMaps: objects,
    },
  } as unknown as Parameters<typeof validateLinkedFieldMetadata>[0];
  return { args, source, relation, linked, fields, objects, destination };
};

describe('linked field metadata invariants', () => {
  it.each([
    FieldMetadataType.SELECT,
    FieldMetadataType.MULTI_SELECT,
    FieldMetadataType.RATING,
  ])('preserves a %s link through field creation', async (type) => {
    const { linked, fields, objects } = setup();
    const result = await fromCreateFieldInputToFlatFieldMetadatasToCreate({
      createFieldInput: {
        objectMetadataId: 'recruitment',
        name: 'linkedValue',
        label: 'Linked value',
        type,
        settings: linked.settings,
        options: [
          { value: 'READY', label: 'Ready', color: 'green', position: 0 },
        ],
      },
      flatApplication: {
        universalIdentifier: 'application',
      } as FlatApplication,
      flatFieldMetadataMaps: fields,
      flatObjectMetadataMaps: {
        ...objects,
        universalIdentifierById: {
          recruitment: 'recruitment',
          person: 'person',
        },
      },
    });
    expect(result.status).toBe('success');
    if (result.status !== 'success') {
      throw new Error('Expected linked metadata creation to succeed');
    }
    const field = result.result.flatFieldMetadatas[0];
    expect(field.universalSettings).toEqual(linked.universalSettings);
    expect(field.isUIEditable).toBe(false);
    expect(field.defaultValue).toBeNull();
  });
  it('accepts a read-only direct Person field without changing existing data', () => {
    expect(validateLinkedFieldMetadata(setup().args)).toEqual([]);
  });

  it.each([
    { isUIEditable: true },
    { isUnique: true },
    { isNullable: false },
    { defaultValue: "'copied'" },
    { type: FieldMetadataType.NUMBER },
    { universalSettings: { linkedField: {} } },
  ])('rejects invalid destination metadata %j', (override) => {
    const { args, linked } = setup();
    expect(
      validateLinkedFieldMetadata({
        ...args,
        flatEntityToValidate: {
          ...linked,
          ...override,
        } as UniversalFlatFieldMetadata,
      }),
    ).not.toEqual([]);
  });

  it.each([
    'missing-source',
    'to-many',
    'wrong-object',
    'inactive',
    'recursive',
  ])('rejects a %s source path', (scenario) => {
    const { args, fields } = setup();
    if (scenario === 'missing-source') {
      delete (fields.byUniversalIdentifier as Record<string, unknown>).source;
    }
    if (scenario === 'to-many') {
      fields.byUniversalIdentifier.relation.universalSettings = {
        relationType: RelationType.ONE_TO_MANY,
      };
    }
    if (scenario === 'wrong-object') {
      fields.byUniversalIdentifier.relation.objectMetadataUniversalIdentifier =
        'elsewhere';
    }
    if (scenario === 'inactive') {
      fields.byUniversalIdentifier.source.isActive = false;
    }
    if (scenario === 'recursive') {
      fields.byUniversalIdentifier.source.universalSettings =
        fields.byUniversalIdentifier.linked.universalSettings;
    }
    expect(validateLinkedFieldMetadata(args)).not.toEqual([]);
  });

  it('allows a source rename but protects deletion, deactivation and type changes', () => {
    const { source, fields, objects } = setup();
    expect(
      validateLinkedFieldDependencies({
        before: source,
        after: { ...source, name: 'occupation' },
        fields,
        objects,
      }),
    ).toEqual([]);
    for (const after of [
      undefined,
      { ...source, isActive: false },
      { ...source, type: FieldMetadataType.NUMBER },
    ]) {
      expect(
        validateLinkedFieldDependencies({
          before: source,
          after,
          fields,
          objects,
        }),
      ).not.toEqual([]);
    }
  });

  it('protects the relation cardinality and prevents converting stored fields', () => {
    const { source, relation, linked, fields, objects } = setup();
    expect(
      validateLinkedFieldDependencies({
        before: relation,
        after: {
          ...relation,
          universalSettings: { relationType: RelationType.ONE_TO_MANY },
        },
        fields,
        objects,
      }),
    ).not.toEqual([]);
    expect(
      validateLinkedFieldDependencies({
        before: source,
        after: { ...source, universalSettings: linked.universalSettings },
        fields,
        objects,
      }),
    ).not.toEqual([]);
    expect(
      validateLinkedFieldDependencies({
        before: linked,
        after: { ...linked, universalSettings: null },
        fields,
        objects,
      }),
    ).not.toEqual([]);
  });

  it('allows removing a source after its dependent object is removed in the same migration', () => {
    const { source, fields, objects } = setup();
    delete (objects.byUniversalIdentifier as Record<string, unknown>)
      .recruitment;
    expect(
      validateLinkedFieldDependencies({ before: source, fields, objects }),
    ).toEqual([]);
  });

  it.each([
    FieldMetadataType.TEXT,
    FieldMetadataType.SELECT,
    FieldMetadataType.MULTI_SELECT,
    FieldMetadataType.FULL_NAME,
  ])('creates no workspace columns or enums for linked %s fields', (type) => {
    const { linked, destination } = setup();
    const field = { ...linked, type };
    expect(
      generateColumnDefinitions({
        flatFieldMetadata: field,
        flatObjectMetadata: destination,
        workspaceId: destination.workspaceId,
      }),
    ).toEqual([]);
    for (const operation of [
      EnumOperation.CREATE,
      EnumOperation.DROP,
      EnumOperation.RENAME,
    ]) {
      expect(
        collectEnumOperationsForField({
          flatFieldMetadata: field,
          tableName: 'recruitment',
          operation,
        }),
      ).toEqual([]);
    }
  });
});
