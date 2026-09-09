import { FieldMetadataType } from 'twenty-shared/types';
import { v4 } from 'uuid';

import { buildPersonPreferredNameSearchFields } from 'src/database/commands/upgrade-version-command/2-38/utils/build-person-preferred-name-search-fields.util';
import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { getFlatObjectMetadataMock } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/get-flat-object-metadata.mock';
import { type FlatSearchFieldMetadata } from 'src/engine/metadata-modules/flat-search-field-metadata/types/flat-search-field-metadata.type';
import { SEARCH_FIELDS_BY_STANDARD_OBJECT_NAME } from 'src/engine/workspace-manager/twenty-standard-application/constants/search-fields-by-standard-object-name.constant';

const person = getFlatObjectMetadataMock({
  universalIdentifier: v4(),
  nameSingular: 'person',
});
const standardFields = SEARCH_FIELDS_BY_STANDARD_OBJECT_NAME.person.map(
  (field) =>
    getFlatFieldMetadataMock({
      ...field,
      universalIdentifier: v4(),
      objectMetadataId: person.id,
      applicationUniversalIdentifier: person.applicationUniversalIdentifier,
    }),
);
const preferredName = getFlatFieldMetadataMock({
  name: 'preferredName',
  type: FieldMetadataType.TEXT,
  universalIdentifier: v4(),
  objectMetadataId: person.id,
});
const searchVector = getFlatFieldMetadataMock({
  name: 'searchVector',
  type: FieldMetadataType.TS_VECTOR,
  universalIdentifier: v4(),
  objectMetadataId: person.id,
});
const fields = [...standardFields, preferredName, searchVector];

describe('buildPersonPreferredNameSearchFields', () => {
  it('should retain legacy name, email, phone and job-title search when adding preferred name', () => {
    const plan = buildPersonPreferredNameSearchFields({
      person,
      fields,
      searchFields: [],
    });
    expect(
      plan?.fieldsToCreate.map(
        (field) => field.fieldMetadataUniversalIdentifier,
      ),
    ).toEqual(
      [...standardFields, preferredName].map(
        (field) => field.universalIdentifier,
      ),
    );
    expect(
      plan?.fieldsToCreate.every(
        (field) =>
          field.tsVectorFieldMetadataUniversalIdentifier ===
          searchVector.universalIdentifier,
      ),
    ).toBe(true);
    expect(
      plan?.fieldsToCreate.find(
        (field) =>
          field.fieldMetadataUniversalIdentifier ===
          preferredName.universalIdentifier,
      )?.applicationUniversalIdentifier,
    ).toBe(preferredName.applicationUniversalIdentifier);
  });

  it('should preserve existing custom search fields and append only missing fields', () => {
    const existingSearchFields = standardFields.map(
      (field, position) =>
        ({
          objectMetadataId: person.id,
          fieldMetadataId: field.id,
          position,
        }) as FlatSearchFieldMetadata,
    );
    existingSearchFields.push({
      objectMetadataId: person.id,
      fieldMetadataId: 'other-custom-field',
      position: 8,
    } as FlatSearchFieldMetadata);
    const plan = buildPersonPreferredNameSearchFields({
      person,
      fields,
      searchFields: existingSearchFields,
    });
    expect(plan?.fieldsToCreate).toHaveLength(1);
    expect(plan?.fieldsToCreate[0].position).toBe(9);
    expect(existingSearchFields).toHaveLength(5);
  });

  it('should not duplicate search metadata on a retry', () => {
    const searchFields = [...standardFields, preferredName].map(
      (field, position) =>
        ({
          objectMetadataId: person.id,
          fieldMetadataId: field.id,
          position,
        }) as FlatSearchFieldMetadata,
    );
    expect(
      buildPersonPreferredNameSearchFields({ person, fields, searchFields })
        ?.fieldsToCreate,
    ).toEqual([]);
  });

  it.each([
    [fields.filter((field) => field.id !== preferredName.id)],
    [
      fields.map((field) =>
        field.id === preferredName.id ? { ...field, isActive: false } : field,
      ),
    ],
    [fields.filter((field) => field.id !== searchVector.id)],
  ])(
    'should skip workspaces without an active preferred name and search vector',
    (availableFields) => {
      expect(
        buildPersonPreferredNameSearchFields({
          person,
          fields: availableFields,
          searchFields: [],
        }),
      ).toBeUndefined();
    },
  );
});
