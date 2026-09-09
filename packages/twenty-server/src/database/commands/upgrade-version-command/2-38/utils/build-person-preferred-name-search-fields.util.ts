import { FieldMetadataType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type FlatSearchFieldMetadata } from 'src/engine/metadata-modules/flat-search-field-metadata/types/flat-search-field-metadata.type';
import { buildFlatSearchFieldMetadataForField } from 'src/engine/metadata-modules/flat-search-field-metadata/utils/build-flat-search-field-metadata-for-field.util';
import { SEARCH_FIELDS_BY_STANDARD_OBJECT_NAME } from 'src/engine/workspace-manager/twenty-standard-application/constants/search-fields-by-standard-object-name.constant';

export const buildPersonPreferredNameSearchFields = ({
  person,
  fields,
  searchFields,
}: {
  person: FlatObjectMetadata;
  fields: FlatFieldMetadata[];
  searchFields: FlatSearchFieldMetadata[];
}) => {
  const personFields = fields.filter(
    (field) => field.objectMetadataId === person.id,
  );
  const preferredName = personFields.find(
    (field) =>
      field.name === 'preferredName' &&
      field.type === FieldMetadataType.TEXT &&
      field.isActive,
  );
  const searchVector = personFields.find(
    (field) =>
      field.name === 'searchVector' &&
      field.type === FieldMetadataType.TS_VECTOR,
  );

  if (!isDefined(preferredName) || !isDefined(searchVector)) {
    return undefined;
  }

  const existingSearchFields = searchFields.filter(
    (field) => field.objectMetadataId === person.id,
  );
  // Legacy workspaces can have a generated vector but no search metadata.
  // Seed its existing standard fields before rebuilding, preserving name,
  // email, phone and job-title lookup as well as any configured custom fields.
  const candidates = [
    ...SEARCH_FIELDS_BY_STANDARD_OBJECT_NAME.person
      .map((definition) =>
        personFields.find(
          (field) =>
            field.name === definition.name && field.type === definition.type,
        ),
      )
      .filter(isDefined),
    preferredName,
  ];
  const nextPosition =
    Math.max(-1, ...existingSearchFields.map((field) => field.position)) + 1;
  const fieldsToCreate = candidates
    .filter(
      (field) =>
        !existingSearchFields.some(
          (searchField) => searchField.fieldMetadataId === field.id,
        ),
    )
    .map((field, index) =>
      buildFlatSearchFieldMetadataForField({
        flatObjectMetadata: {
          ...person,
          applicationUniversalIdentifier: field.applicationUniversalIdentifier,
        },
        flatFieldMetadata: field,
        tsVectorFlatFieldMetadata: searchVector,
        position: nextPosition + index,
      }),
    );

  return { fieldsToCreate, searchVector };
};
