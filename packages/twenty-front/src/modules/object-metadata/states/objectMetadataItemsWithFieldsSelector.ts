import { currentUserWorkspaceState } from '@/auth/states/currentUserWorkspaceState';
import { fieldMetadataItemsSelector } from '@/metadata-store/states/fieldMetadataItemsSelector';
import { indexMetadataItemsSelector } from '@/metadata-store/states/indexMetadataItemsSelector';
import { flatObjectMetadataItemsSelector } from '@/object-metadata/states/flatObjectMetadataItemsSelector';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { getNonReadableFieldMetadataIdsFromObjectPermissions } from '@/object-metadata/utils/getNonReadableFieldMetadataIdsFromObjectPermissions';
import { getNonUpdatableFieldMetadataIdsFromObjectPermissions } from '@/object-metadata/utils/getNonUpdatableFieldMetadataIdsFromObjectPermissions';
import { getObjectPermissionsFromMapByObjectMetadataId } from '@/settings/roles/role-permissions/objects-permissions/utils/getObjectPermissionsFromMapByObjectMetadataId';
import { createAtomSelector } from '@/ui/utilities/state/jotai/utils/createAtomSelector';
import { type ObjectPermissions } from 'twenty-shared/types';
import { getLinkedFieldReference, isDefined } from 'twenty-shared/utils';

export const objectMetadataItemsWithFieldsSelector = createAtomSelector<
  EnrichedObjectMetadataItem[]
>({
  key: 'objectMetadataItemsWithFieldsSelector',
  get: ({ get }) => {
    const flatObjects = get(flatObjectMetadataItemsSelector);
    const allFlatFields = get(fieldMetadataItemsSelector);
    const allFlatIndexes = get(indexMetadataItemsSelector);
    const currentUserWorkspace = get(currentUserWorkspaceState);
    const fieldByUniversalIdentifier = new Map(
      allFlatFields.map((field) => [field.universalIdentifier, field]),
    );

    const fieldsByObjectId = new Map<
      string,
      (typeof allFlatFields)[number][]
    >();

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

    const objectPermissionsByObjectMetadataId =
      currentUserWorkspace?.objectsPermissions.reduce(
        (accumulator, objectPermission) => {
          accumulator[objectPermission.objectMetadataId] = objectPermission;

          return accumulator;
        },
        {} as Record<string, ObjectPermissions & { objectMetadataId: string }>,
      ) ?? {};

    return flatObjects.map((flatObject) => {
      const fields = fieldsByObjectId.get(flatObject.id) ?? [];
      const indexMetadatas = indexesByObjectId.get(flatObject.id) ?? [];

      const objectPermissions = getObjectPermissionsFromMapByObjectMetadataId({
        objectPermissionsByObjectMetadataId,
        objectMetadataId: flatObject.id,
      });

      const nonReadableFieldMetadataIds =
        getNonReadableFieldMetadataIdsFromObjectPermissions({
          objectPermissions,
        });

      const nonUpdatableFieldMetadataIds =
        getNonUpdatableFieldMetadataIdsFromObjectPermissions({
          objectPermissions,
        });

      const canReadLinkedSource = (field: (typeof fields)[number]) => {
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
          const sourcePermissions =
            getObjectPermissionsFromMapByObjectMetadataId({
              objectPermissionsByObjectMetadataId,
              objectMetadataId: source.objectMetadataId,
            });
          return (
            sourcePermissions.canReadObjectRecords &&
            !getNonReadableFieldMetadataIdsFromObjectPermissions({
              objectPermissions: sourcePermissions,
            }).includes(source.id)
          );
        });
      };

      return {
        ...flatObject,
        fields,
        indexMetadatas,
        searchFieldMetadatas: flatObject.searchFieldMetadatas ?? [],
        readableFields: fields.filter(
          (field) =>
            !nonReadableFieldMetadataIds.includes(field.id) &&
            canReadLinkedSource(field),
        ),
        updatableFields: fields.filter(
          (field) =>
            !nonUpdatableFieldMetadataIds.includes(field.id) &&
            !isDefined(getLinkedFieldReference(field.settings)),
        ),
      } satisfies EnrichedObjectMetadataItem;
    });
  },
});
