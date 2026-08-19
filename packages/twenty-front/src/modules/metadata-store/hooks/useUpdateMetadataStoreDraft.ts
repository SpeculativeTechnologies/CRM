import { isMinimalMetadataReadyState } from '@/metadata-store/states/isMinimalMetadataReadyState';
import {
  ALL_METADATA_ENTITY_KEYS,
  metadataStoreState,
  type MetadataEntityKey,
  type MetadataStoreItem,
} from '@/metadata-store/states/metadataStoreState';
import { type MetadataEntityTypeMap } from '@/metadata-store/types/MetadataEntityTypeMap';
import { useStore, type createStore } from 'jotai';
import { useCallback } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { isDeeplyEqual } from '~/utils/isDeeplyEqual';

type JotaiStore = ReturnType<typeof createStore>;

const EMPTY_ENTRY: MetadataStoreItem = {
  current: [],
  draft: [],
  status: 'empty',
};

const areViewsConsistentWithObjects = (
  viewsDraft: object[],
  objectsCurrent: object[],
): boolean => {
  const objectIds = new Set(
    objectsCurrent.map((item) => (item as { id: string }).id),
  );

  return viewsDraft.every((view) =>
    objectIds.has((view as { objectMetadataId: string }).objectMetadataId),
  );
};

export const resetMetadataStore = (store: JotaiStore) => {
  for (const key of ALL_METADATA_ENTITY_KEYS) {
    store.set(metadataStoreState.atomFamily(key), EMPTY_ENTRY);
  }

  store.set(isMinimalMetadataReadyState.atom, false);
};

const changeMetadataEntityAsUpToDate = (
  store: JotaiStore,
  metadataEntityKey: MetadataEntityKey,
) => {
  const entry = store.get(metadataStoreState.atomFamily(metadataEntityKey));

  store.set(metadataStoreState.atomFamily(metadataEntityKey), {
    current: entry.draft,
    draft: [],
    status: 'up-to-date',
    currentCollectionHash:
      entry.draftCollectionHash ?? entry.currentCollectionHash,
    draftCollectionHash: undefined,
  });
};

// A loaded collection whose refetch short-circuited on identical data still
// carries the newer server hash in draftCollectionHash; promote it so the
// next boot's hash comparison succeeds.
const promotePendingCollectionHash = (
  store: JotaiStore,
  metadataEntityKey: MetadataEntityKey,
): boolean => {
  const entry = store.get(metadataStoreState.atomFamily(metadataEntityKey));

  if (
    entry.status !== 'up-to-date' ||
    !isDefined(entry.draftCollectionHash) ||
    entry.draftCollectionHash === entry.currentCollectionHash
  ) {
    return false;
  }

  store.set(metadataStoreState.atomFamily(metadataEntityKey), (prev) => ({
    ...prev,
    currentCollectionHash: prev.draftCollectionHash,
    draftCollectionHash: undefined,
  }));

  return true;
};

export const useUpdateMetadataStoreDraft = () => {
  const store = useStore();

  const replaceDraft = useCallback(
    <K extends MetadataEntityKey>(
      key: K,
      data: MetadataEntityTypeMap[K][],
      collectionHash?: string,
    ) => {
      const currentEntry = store.get(metadataStoreState.atomFamily(key));

      if (
        currentEntry.status === 'up-to-date' &&
        isDeeplyEqual(currentEntry.current, data)
      ) {
        // The data is unchanged but the server hash may be new (or was never
        // adopted). Without adopting it here, the collection compares stale
        // on every subsequent boot and refetches forever.
        const adoptedCollectionHash =
          collectionHash ?? currentEntry.draftCollectionHash;

        if (
          isDefined(adoptedCollectionHash) &&
          currentEntry.currentCollectionHash !== adoptedCollectionHash
        ) {
          store.set(metadataStoreState.atomFamily(key), (prev) => ({
            ...prev,
            currentCollectionHash: adoptedCollectionHash,
            draftCollectionHash: undefined,
          }));
        }

        return;
      }

      store.set(metadataStoreState.atomFamily(key), (prev) => ({
        ...prev,
        draft: data,
        status: 'draft-pending' as const,
        ...(collectionHash !== undefined
          ? { draftCollectionHash: collectionHash }
          : {}),
      }));
    },
    [store],
  );

  const applyChanges = useCallback((): {
    hasPersistedAnyMetadataEntity: boolean;
  } => {
    let hasPersistedAnyMetadataEntity = false;

    for (const metadataEntityKey of ALL_METADATA_ENTITY_KEYS) {
      if (metadataEntityKey === 'views') {
        continue;
      }

      const metadataStoreEntityEntry = store.get(
        metadataStoreState.atomFamily(metadataEntityKey),
      );

      if (metadataStoreEntityEntry.status === 'draft-pending') {
        changeMetadataEntityAsUpToDate(store, metadataEntityKey);
        hasPersistedAnyMetadataEntity = true;
      } else if (promotePendingCollectionHash(store, metadataEntityKey)) {
        hasPersistedAnyMetadataEntity = true;
      }
    }

    const viewsEntry = store.get(metadataStoreState.atomFamily('views'));

    if (viewsEntry.status === 'draft-pending') {
      const objectsEntry = store.get(
        metadataStoreState.atomFamily('objectMetadataItems'),
      );

      if (
        areViewsConsistentWithObjects(viewsEntry.draft, objectsEntry.current)
      ) {
        changeMetadataEntityAsUpToDate(store, 'views');
        hasPersistedAnyMetadataEntity = true;
      }
    } else if (promotePendingCollectionHash(store, 'views')) {
      hasPersistedAnyMetadataEntity = true;
    }

    return { hasPersistedAnyMetadataEntity };
  }, [store]);

  const addToDraft = useCallback(
    <K extends MetadataEntityKey>({
      key,
      items,
      collectionHash,
    }: {
      key: K;
      items: MetadataEntityTypeMap[K][];
      collectionHash?: string;
    }) => {
      if (items.length === 0) {
        return;
      }

      const entry = store.get(metadataStoreState.atomFamily(key));
      const baseItems = (
        entry.status === 'draft-pending' ? entry.draft : entry.current
      ) as Array<{ id: string }>;

      let newItems = [...baseItems];

      for (const item of items) {
        const newItem = item as unknown as { id: string };
        const existingIndex = newItems.findIndex(
          (existing) => existing.id === newItem.id,
        );

        if (existingIndex >= 0) {
          if (!isDeeplyEqual(newItems[existingIndex], newItem)) {
            newItems[existingIndex] = newItem;
          }
        } else {
          newItems = [...newItems, newItem];
        }
      }

      store.set(metadataStoreState.atomFamily(key), {
        ...entry,
        draft: newItems,
        status: 'draft-pending' as const,
        ...(collectionHash !== undefined
          ? { draftCollectionHash: collectionHash }
          : {}),
      });
    },
    [store],
  );

  const updateInDraft = useCallback(
    <K extends MetadataEntityKey>(
      key: K,
      items: MetadataEntityTypeMap[K][],
      collectionHash?: string,
    ) => {
      if (items.length === 0) {
        return;
      }

      const entry = store.get(metadataStoreState.atomFamily(key));
      const baseItems = (
        entry.status === 'draft-pending' ? entry.draft : entry.current
      ) as Array<{ id: string }>;

      let hasChanged = false;
      const newItems = baseItems.map((existing) => {
        const updatedItem = (items as unknown as Array<{ id: string }>).find(
          (item) => item.id === existing.id,
        );

        if (!isDefined(updatedItem)) {
          return existing;
        }

        const merged = { ...existing, ...updatedItem };

        if (isDeeplyEqual(existing, merged)) {
          return existing;
        }

        hasChanged = true;

        return merged;
      });

      if (!hasChanged && collectionHash === undefined) {
        return;
      }

      store.set(metadataStoreState.atomFamily(key), {
        ...entry,
        draft: hasChanged ? newItems : baseItems,
        status: 'draft-pending' as const,
        ...(collectionHash !== undefined
          ? { draftCollectionHash: collectionHash }
          : {}),
      });
    },
    [store],
  );

  const removeFromDraft = useCallback(
    <K extends MetadataEntityKey>({
      key,
      itemIds,
      collectionHash,
    }: {
      key: K;
      itemIds: string[];
      collectionHash?: string;
    }) => {
      if (itemIds.length === 0) {
        return;
      }

      const entry = store.get(metadataStoreState.atomFamily(key));
      const baseItems = (
        entry.status === 'draft-pending' ? entry.draft : entry.current
      ) as Array<{ id: string }>;

      const idsToDelete = new Set(itemIds);
      const newItems = baseItems.filter(
        (existing) => !idsToDelete.has(existing.id),
      );

      if (
        newItems.length === baseItems.length &&
        collectionHash === undefined
      ) {
        return;
      }

      store.set(metadataStoreState.atomFamily(key), {
        ...entry,
        draft: newItems,
        status: 'draft-pending' as const,
        ...(collectionHash !== undefined
          ? { draftCollectionHash: collectionHash }
          : {}),
      });
    },
    [store],
  );

  const reset = useCallback(() => {
    resetMetadataStore(store);
  }, [store]);

  return {
    replaceDraft,
    applyChanges,
    addToDraft,
    updateInDraft,
    removeFromDraft,
    resetMetadataStore: reset,
  };
};
