import { atom } from 'jotai';

import { metadataStoreState } from '@/metadata-store/states/metadataStoreState';
import { type MetadataEntityTypeMap } from '@/metadata-store/types/MetadataEntityTypeMap';
import { type ComponentState } from '@/ui/utilities/state/jotai/types/ComponentState';
import { createAtomComponentState } from '@/ui/utilities/state/jotai/utils/createAtomComponentState';
import { isDefined } from 'twenty-shared/utils';

// Metadata and saved-view events can arrive separately. Readers must never
// receive a sort/filter whose field has already disappeared from the metadata.
export const createRecordFieldDependentComponentState = <
  T extends {
    fieldMetadataId: string;
    relationTargetFieldMetadataId?: string | null;
  },
>(
  options: Parameters<typeof createAtomComponentState<T[]>>[0],
): ComponentState<T[]> => {
  const rawState = createAtomComponentState<T[]>(options);
  const atoms = new Map<
    string,
    ReturnType<ComponentState<T[]>['atomFamily']>
  >();

  return {
    ...rawState,
    atomFamily: (key) => {
      const existing = atoms.get(key.instanceId);
      if (isDefined(existing)) {
        return existing;
      }

      const rawAtom = rawState.atomFamily(key);
      const filteredAtom = atom(
        (get) => {
          const entries = get(rawAtom);
          const metadata = get(
            metadataStoreState.atomFamily('fieldMetadataItems'),
          );
          if (metadata.status === 'empty') {
            return entries;
          }

          const fields =
            metadata.current as MetadataEntityTypeMap['fieldMetadataItems'][];
          const fieldIds = new Set(fields.map((field) => field.id));
          const validEntries = entries.filter(
            (entry) =>
              fieldIds.has(entry.fieldMetadataId) &&
              (!isDefined(entry.relationTargetFieldMetadataId) ||
                fieldIds.has(entry.relationTargetFieldMetadataId)),
          );
          return validEntries.length === entries.length
            ? entries
            : validEntries;
        },
        (get, set, update: T[] | ((previous: T[]) => T[])) => {
          set(
            rawAtom,
            typeof update === 'function' ? update(get(filteredAtom)) : update,
          );
        },
      );
      filteredAtom.debugLabel = `${options.key}__${key.instanceId}`;
      atoms.set(key.instanceId, filteredAtom);
      return filteredAtom;
    },
  };
};
