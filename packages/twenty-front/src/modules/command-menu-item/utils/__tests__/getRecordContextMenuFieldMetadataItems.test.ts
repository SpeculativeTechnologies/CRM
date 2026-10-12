import { getRecordContextMenuFieldMetadataItems } from '@/command-menu-item/utils/getRecordContextMenuFieldMetadataItems';
import { getTestEnrichedObjectMetadataItemsMock } from '~/testing/utils/getTestEnrichedObjectMetadataItemsMock';
import { FieldMetadataType } from '~/generated-metadata/graphql';

describe('getRecordContextMenuFieldMetadataItems', () => {
  const objectMetadataItems = getTestEnrichedObjectMetadataItemsMock();
  const personObjectMetadataItem = objectMetadataItems.find(
    (objectMetadataItem) => objectMetadataItem.nameSingular === 'person',
  );

  if (personObjectMetadataItem === undefined) {
    throw new Error('Person object metadata not found');
  }

  it('should offer contact fields of a person as quick items', () => {
    const { contactFieldMetadataItems } =
      getRecordContextMenuFieldMetadataItems({
        objectMetadataItem: personObjectMetadataItem,
        objectMetadataItems,
        isFieldReadOnly: () => false,
      });

    const contactFieldNames = contactFieldMetadataItems.map(
      (fieldMetadataItem) => fieldMetadataItem.name,
    );

    expect(contactFieldNames).toEqual(
      expect.arrayContaining(['emails', 'phones', 'linkedinLink']),
    );
    expect(
      contactFieldMetadataItems.every((fieldMetadataItem) =>
        [
          FieldMetadataType.EMAILS,
          FieldMetadataType.PHONES,
          FieldMetadataType.LINKS,
        ].includes(fieldMetadataItem.type),
      ),
    ).toBe(true);
  });

  it('should leave out timestamps, actors and read-only fields', () => {
    const { editableFieldMetadataItems } =
      getRecordContextMenuFieldMetadataItems({
        objectMetadataItem: personObjectMetadataItem,
        objectMetadataItems,
        isFieldReadOnly: (fieldMetadataItem) =>
          fieldMetadataItem.name === 'jobTitle',
      });

    const editableFieldNames = editableFieldMetadataItems.map(
      (fieldMetadataItem) => fieldMetadataItem.name,
    );

    expect(editableFieldNames).toContain('name');
    expect(editableFieldNames).toContain('company');
    expect(editableFieldNames).not.toContain('jobTitle');
    expect(editableFieldNames).not.toContain('createdAt');
    expect(editableFieldNames).not.toContain('createdBy');
  });

  it('should sort fields by label', () => {
    const { editableFieldMetadataItems } =
      getRecordContextMenuFieldMetadataItems({
        objectMetadataItem: personObjectMetadataItem,
        objectMetadataItems,
        isFieldReadOnly: () => false,
      });

    const labels = editableFieldMetadataItems.map(
      (fieldMetadataItem) => fieldMetadataItem.label,
    );

    expect(labels).toEqual(
      [...labels].sort((labelA, labelB) => labelA.localeCompare(labelB)),
    );
  });
});
