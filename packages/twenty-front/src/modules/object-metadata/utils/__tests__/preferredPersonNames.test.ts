import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { getLabelIdentifierFieldValue } from '@/object-metadata/utils/getLabelIdentifierFieldValue';
import { buildIdentifierGqlFields } from '@/object-record/graphql/record-gql-fields/utils/buildIdentifierGqlFields';
import { getObjectFilterFields } from '@/object-record/select/utils/getObjectFilterFields';
import { FieldMetadataType } from 'twenty-shared/types';

const nameField = {
  id: 'name',
  name: 'name',
  type: FieldMetadataType.FULL_NAME,
  isActive: true,
} as FieldMetadataItem;
const preferredNameField = {
  id: 'preferredName',
  name: 'preferredName',
  type: FieldMetadataType.TEXT,
  isActive: true,
} as FieldMetadataItem;
const person = {
  __typename: 'Person',
  id: 'synthetic-person',
  name: { firstName: 'Timothy', lastName: 'McGee' },
  preferredName: 'Tim',
};

describe('preferred person names', () => {
  it('should display Tim McGee while preserving Timothy in the stored name', () => {
    expect(getLabelIdentifierFieldValue(person, nameField, 'person')).toBe(
      'Tim McGee',
    );
    expect(person.name.firstName).toBe('Timothy');
  });

  it.each([undefined, null, '', '  '])(
    'should display the stored name when preferred name is %p',
    (preferredName) => {
      expect(
        getLabelIdentifierFieldValue(
          { ...person, preferredName },
          nameField,
          'person',
        ),
      ).toBe('Timothy McGee');
    },
  );

  it('should leave workspace-member and custom full-name labels unchanged', () => {
    expect(
      getLabelIdentifierFieldValue(person, nameField, 'workspaceMember'),
    ).toBe('Timothy McGee');
    expect(
      getLabelIdentifierFieldValue(
        { ...person, otherName: person.name },
        { ...nameField, name: 'otherName' },
        'person',
      ),
    ).toBe('Timothy McGee');
  });

  it('should request preferred names for person relation chips only when the field exists', () => {
    const metadata = {
      nameSingular: 'person',
      fields: [nameField, preferredNameField],
      labelIdentifierFieldMetadataId: 'name',
      imageIdentifierFieldMetadataId: null,
    };
    expect(buildIdentifierGqlFields(metadata)).toEqual({
      id: true,
      name: true,
      preferredName: true,
    });
    expect(
      buildIdentifierGqlFields({ ...metadata, fields: [nameField] }),
    ).toEqual({ id: true, name: true });
    expect(
      buildIdentifierGqlFields({
        ...metadata,
        nameSingular: 'workspaceMember',
      }),
    ).toEqual({ id: true, name: true });
  });

  it('should search person selectors by both names without querying absent fields', () => {
    expect(getObjectFilterFields('person', true)).toEqual([
      'name.firstName',
      'name.lastName',
      'preferredName',
    ]);
    expect(getObjectFilterFields('person')).toEqual([
      'name.firstName',
      'name.lastName',
    ]);
    expect(getObjectFilterFields('workspaceMember', true)).toEqual([
      'name.firstName',
      'name.lastName',
    ]);
  });
});
