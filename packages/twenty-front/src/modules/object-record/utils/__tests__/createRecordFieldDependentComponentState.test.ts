import { createStore } from 'jotai';

import { metadataStoreState } from '@/metadata-store/states/metadataStoreState';
import { createRecordFieldDependentComponentState } from '@/object-record/utils/createRecordFieldDependentComponentState';

describe('record field dependent state', () => {
  const state = createRecordFieldDependentComponentState<{
    fieldMetadataId: string;
    relationTargetFieldMetadataId?: string;
  }>({
    key: 'testRecordFieldDependentState',
    defaultValue: [],
    componentInstanceContext: null,
  });

  it('should remove stale sorts and filters immediately when metadata disappears, including before view events arrive', () => {
    const store = createStore();
    const fieldMetadata = metadataStoreState.atomFamily('fieldMetadataItems');
    store.set(fieldMetadata, {
      current: [{ id: 'linked' }, { id: 'name' }, { id: 'source' }],
      draft: [],
      status: 'up-to-date',
    });
    const firstView = state.atomFamily({ instanceId: 'first' });
    const secondView = state.atomFamily({ instanceId: 'second' });
    const unrelated = { fieldMetadataId: 'name' };
    store.set(firstView, [{ fieldMetadataId: 'linked' }, unrelated]);
    store.set(secondView, [
      { fieldMetadataId: 'name', relationTargetFieldMetadataId: 'source' },
      unrelated,
    ]);
    expect(store.get(firstView)).toHaveLength(2);
    expect(store.get(secondView)).toHaveLength(2);

    store.set(fieldMetadata, {
      current: [{ id: 'name' }],
      draft: [],
      status: 'up-to-date',
    });
    expect(store.get(firstView)).toEqual([unrelated]);
    expect(store.get(secondView)).toEqual([unrelated]);
    // Functional edits receive only valid state, so saving another change cannot reintroduce the deleted field.
    const update = jest.fn((previous) => previous);
    store.set(firstView, update);
    expect(update).toHaveBeenCalledWith([unrelated]);
  });

  it('should wait for initial metadata and reject deleted references restored from a saved view', () => {
    const store = createStore();
    const fieldMetadata = metadataStoreState.atomFamily('fieldMetadataItems');
    store.set(fieldMetadata, { current: [], draft: [], status: 'empty' });
    const view = state.atomFamily({ instanceId: 'restored' });
    store.set(view, [{ fieldMetadataId: 'deleted' }]);
    expect(store.get(view)).toHaveLength(1);
    store.set(fieldMetadata, { current: [], draft: [], status: 'up-to-date' });
    expect(store.get(view)).toEqual([]);
    store.set(view, [{ fieldMetadataId: 'deleted' }]);
    expect(store.get(view)).toEqual([]);
    expect(state.atomFamily({ instanceId: 'restored' })).toBe(view);
  });
});
