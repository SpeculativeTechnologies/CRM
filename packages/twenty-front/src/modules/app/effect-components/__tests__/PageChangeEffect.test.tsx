import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, render, waitFor } from '@testing-library/react';
import { type getDefaultStore } from 'jotai';
import { type ReactNode } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';

import { PageChangeEffect } from '@/app/effect-components/PageChangeEffect';
import { WorkspaceRouteObjectsContext } from '@/app/routing/components/WorkspaceRouteObjectsProvider';
import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { contextStoreCurrentViewIdComponentState } from '@/context-store/states/contextStoreCurrentViewIdComponentState';
import { contextStoreCurrentViewTypeComponentState } from '@/context-store/states/contextStoreCurrentViewTypeComponentState';
import { ContextStoreViewType } from '@/context-store/types/ContextStoreViewType';
import { recordIndexRecordIdsByGroupComponentFamilyState } from '@/object-record/record-index/states/recordIndexRecordIdsByGroupComponentFamilyState';
import { NO_RECORD_GROUP_FAMILY_KEY } from '@/object-record/record-index/states/selectors/recordIndexAllRecordIdsComponentSelector';
import { isRowSelectedComponentFamilyState } from '@/object-record/record-table/record-table-row/states/isRowSelectedComponentFamilyState';
import { getRecordIndexIdFromObjectNamePluralAndViewId } from '@/object-record/utils/getRecordIndexIdFromObjectNamePluralAndViewId';
import { getJestMetadataAndApolloMocksWrapper } from '~/testing/jest/getJestMetadataAndApolloMocksWrapper';

jest.mock('~/hooks/usePageChangeEffectNavigateLocation', () => ({
  usePageChangeEffectNavigateLocation: () => undefined,
}));

const VIEW_ID = 'view-1';
const RECORD_ID = 'record-1';
const RECORD_INDEX_ID = getRecordIndexIdFromObjectNamePluralAndViewId(
  'people',
  VIEW_ID,
);

const renderOnPeopleIndexPage = () => {
  let capturedStore: ReturnType<typeof getDefaultStore> | undefined;
  let navigateUrl: ((path: string) => void) | undefined;

  const NavigationProbeEffect = () => {
    const navigate = useNavigate();
    navigateUrl = (path: string) => navigate(path);

    return null;
  };

  const BaseWrapper = getJestMetadataAndApolloMocksWrapper({
    apolloMocks: [],
    onInitializeJotaiStore: (store) => {
      capturedStore = store;

      store.set(
        contextStoreCurrentViewTypeComponentState.atomFamily({
          instanceId: MAIN_CONTEXT_STORE_INSTANCE_ID,
        }),
        ContextStoreViewType.Table,
      );
      store.set(
        contextStoreCurrentViewIdComponentState.atomFamily({
          instanceId: MAIN_CONTEXT_STORE_INSTANCE_ID,
        }),
        VIEW_ID,
      );
      store.set(
        recordIndexRecordIdsByGroupComponentFamilyState.atomFamily({
          instanceId: RECORD_INDEX_ID,
          familyKey: NO_RECORD_GROUP_FAMILY_KEY,
        }),
        [RECORD_ID],
      );
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <BaseWrapper>
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/objects/people']}>
          <WorkspaceRouteObjectsContext.Provider value={[]}>
            {children}
            <NavigationProbeEffect />
          </WorkspaceRouteObjectsContext.Provider>
        </MemoryRouter>
      </I18nProvider>
    </BaseWrapper>
  );

  render(<PageChangeEffect />, { wrapper });

  const isRowSelectedAtom = isRowSelectedComponentFamilyState.atomFamily({
    instanceId: RECORD_INDEX_ID,
    familyKey: RECORD_ID,
  });

  return {
    getStore: () => {
      if (!capturedStore) {
        throw new Error('Jotai store was not captured');
      }

      return capturedStore;
    },
    navigate: (path: string) => {
      if (!navigateUrl) {
        throw new Error('Navigation probe was not mounted');
      }

      navigateUrl(path);
    },
    isRowSelectedAtom,
  };
};

describe('PageChangeEffect record index selection', () => {
  it('should keep rows selected when only the query string changes', async () => {
    const { getStore, navigate, isRowSelectedAtom } = renderOnPeopleIndexPage();

    await waitFor(() => {
      expect(getStore()).toBeDefined();
    });

    act(() => {
      getStore().set(isRowSelectedAtom, true);
    });

    act(() => {
      navigate('/objects/people?panel=%2Fobject%2Fperson%2Frecord-1');
    });

    await waitFor(() => {
      expect(getStore().get(isRowSelectedAtom)).toBe(true);
    });
  });

  it('should reset the selection when leaving the record index page', async () => {
    const { getStore, navigate, isRowSelectedAtom } = renderOnPeopleIndexPage();

    await waitFor(() => {
      expect(getStore()).toBeDefined();
    });

    act(() => {
      getStore().set(isRowSelectedAtom, true);
    });

    act(() => {
      navigate('/object/person/record-1');
    });

    await waitFor(() => {
      expect(getStore().get(isRowSelectedAtom)).toBe(false);
    });
  });
});
