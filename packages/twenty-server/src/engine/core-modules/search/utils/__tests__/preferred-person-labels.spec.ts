import { FieldMetadataType } from 'twenty-shared/types';
import { v4 } from 'uuid';

import { getRecordDisplayName } from 'src/engine/core-modules/record-crud/utils/get-record-display-name.util';
import { SearchService } from 'src/engine/core-modules/search/services/search.service';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { getFlatObjectMetadataMock } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/get-flat-object-metadata.mock';

const person = getFlatObjectMetadataMock({
  universalIdentifier: v4(),
  nameSingular: 'person',
});
const nameField = getFlatFieldMetadataMock({
  universalIdentifier: v4(),
  objectMetadataId: person.id,
  name: 'name',
  type: FieldMetadataType.FULL_NAME,
});
person.labelIdentifierFieldMetadataId = nameField.id;
const preferredNameField = getFlatFieldMetadataMock({
  universalIdentifier: v4(),
  objectMetadataId: person.id,
  name: 'preferredName',
  type: FieldMetadataType.TEXT,
});
const maps: FlatEntityMaps<FlatFieldMetadata> = {
  byUniversalIdentifier: {
    [nameField.universalIdentifier]: nameField,
    [preferredNameField.universalIdentifier]: preferredNameField,
  },
  universalIdentifierById: {
    [nameField.id]: nameField.universalIdentifier,
    [preferredNameField.id]: preferredNameField.universalIdentifier,
  },
  universalIdentifiersByApplicationId: {},
};
const searchService = Object.create(SearchService.prototype) as SearchService;

describe('preferred person labels', () => {
  it('should show the same preferred name in search results and record labels', () => {
    expect(
      searchService.getLabelIdentifierValue(
        {
          id: 'synthetic',
          nameFirstName: 'Timothy',
          nameLastName: 'McGee',
          preferredName: 'Tim',
        },
        person,
        maps,
      ),
    ).toBe('Tim McGee');
    expect(
      getRecordDisplayName(
        {
          id: 'synthetic',
          name: { firstName: 'Timothy', lastName: 'McGee' },
          preferredName: 'Tim',
        },
        person,
        maps,
      ),
    ).toBe('Tim McGee');
  });

  it.each([undefined, null, '', '  '])(
    'should retain stored-name labels when preferred name is %p',
    (preferredName) => {
      expect(
        searchService.getLabelIdentifierValue(
          {
            id: 'synthetic',
            nameFirstName: 'Timothy',
            nameLastName: 'McGee',
            preferredName,
          },
          person,
          maps,
        ),
      ).toBe('Timothy McGee');
    },
  );

  it('should select the optional preferred-name column only for people with the active field', () => {
    expect(searchService.getPreferredNameColumns(person, maps)).toEqual([
      'preferredName',
    ]);
    expect(
      searchService.getPreferredNameColumns(
        { ...person, nameSingular: 'workspaceMember' },
        maps,
      ),
    ).toEqual([]);
    expect(
      searchService.getPreferredNameColumns(person, {
        ...maps,
        byUniversalIdentifier: { [nameField.universalIdentifier]: nameField },
      }),
    ).toEqual([]);
  });
});
