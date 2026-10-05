import { fieldMetadataItemsSelector } from '@/metadata-store/states/fieldMetadataItemsSelector';
import { indexMetadataItemsSelector } from '@/metadata-store/states/indexMetadataItemsSelector';
import { flatObjectMetadataItemsSelector } from '@/object-metadata/states/flatObjectMetadataItemsSelector';
import { objectPermissionsByObjectMetadataIdSelector } from '@/object-metadata/states/objectPermissionsByObjectMetadataIdSelector';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { getFieldPermissions } from '@/object-metadata/utils/getFieldPermissions';
import { getObjectPermissionsForObject } from '@/object-metadata/utils/getObjectPermissionsForObject';
import { getPermittedFields } from '@/object-metadata/utils/getPermittedFields';
import { createAtomSelector } from '@/ui/utilities/state/jotai/utils/createAtomSelector';
import { getLinkedFieldReference, isDefined } from 'twenty-shared/utils';

export const objectMetadataItemsWithFieldsSelector = createAtomSelector<
  EnrichedObjectMetadataItem[]
>({
  key: 'objectMetadataItemsWithFieldsSelector',
  get: ({ get }) => {
    const flatObjects = get(flatObjectMetadataItemsSelector);
    const allFlatFields = get(fieldMetadataItemsSelector);
    const allFlatIndexes = get(indexMetadataItemsSelector);
    const objectPermissionsByObjectMetadataId = get(
      objectPermissionsByObjectMetadataIdSelector,
    );

    const fieldByUniversalIdentifier = new Map(
      allFlatFields.map((field) => [field.universalIdentifier, field]),
    );

    const fieldsByObjectId = new Map<
      string,
      (typeof allFlatFields)[number][]
    >();

    // A linked field borrows its source field's options and settings and is not
    // editable in place; the real value lives on the source field.
    for (const rawField of allFlatFields) {
      const linkedField = getLinkedFieldReference(rawField.settings);
      const source = isDefined(linkedField)
        ? fieldByUniversalIdentifier.get(
            linkedField.sourceFieldMetadataUniversalIdentifier,
          )
        : undefined;
      const field = isDefined(source)
        ? {
            ...rawField,
            options: source.options,
            settings: { ...source.settings, linkedField },
            isUIEditable: false,
          }
        : rawField;
      const existing = fieldsByObjectId.get(field.objectMetadataId);

      if (isDefined(existing)) {
        existing.push(field);
      } else {
        fieldsByObjectId.set(field.objectMetadataId, [field]);
      }
    }

    const indexesByObjectId = new Map<
      string,
      (typeof allFlatIndexes)[number][]
    >();

    for (const index of allFlatIndexes) {
      const existing = indexesByObjectId.get(index.objectMetadataId);

      if (isDefined(existing)) {
        existing.push(index);
      } else {
        indexesByObjectId.set(index.objectMetadataId, [index]);
      }
    }

    const canReadLinkedSource = (
      field: Pick<FieldMetadataItem, 'settings'>,
    ): boolean => {
      const reference = getLinkedFieldReference(field.settings);
      if (!isDefined(reference)) {
        return true;
      }
      return [
        reference.relationFieldMetadataUniversalIdentifier,
        reference.sourceFieldMetadataUniversalIdentifier,
      ].every((identifier) => {
        const source = fieldByUniversalIdentifier.get(identifier);
        if (!isDefined(source) || !source.isActive) {
          return false;
        }
        const sourcePermissions = getObjectPermissionsForObject(
          objectPermissionsByObjectMetadataId,
          source.objectMetadataId,
        );
        return (
          sourcePermissions.canReadObjectRecords &&
          getFieldPermissions({
            objectPermissions: sourcePermissions,
            fieldMetadataId: source.id,
          }).canReadField
        );
      });
    };

    return flatObjects.map((flatObject) => {
      const fields = fieldsByObjectId.get(flatObject.id) ?? [];
      const indexMetadatas = indexesByObjectId.get(flatObject.id) ?? [];

      const { readableFields, updatableFields } = getPermittedFields({
        fields,
        objectPermissions: getObjectPermissionsForObject(
          objectPermissionsByObjectMetadataId,
          flatObject.id,
        ),
      });

      return {
        ...flatObject,
        fields,
        indexMetadatas,
        searchFieldMetadatas: flatObject.searchFieldMetadatas ?? [],
        readableFields: readableFields.filter((field) =>
          canReadLinkedSource(field),
        ),
        updatableFields: updatableFields.filter(
          (field) => !isDefined(getLinkedFieldReference(field.settings)),
        ),
      } satisfies EnrichedObjectMetadataItem;
    });
  },
});
