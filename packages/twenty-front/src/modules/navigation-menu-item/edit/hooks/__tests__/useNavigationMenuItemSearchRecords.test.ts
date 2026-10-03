import { type NavigationMenuItem } from '~/generated-metadata/graphql';
import { NavigationMenuItemType } from 'twenty-shared/types';
import { useObjectRecordSearchRecords } from '@/object-record/hooks/useObjectRecordSearchRecords';
import { act, renderHook } from '@testing-library/react';
import { useNavigationMenuItemSearchRecords } from '@/navigation-menu-item/edit/hooks/useNavigationMenuItemSearchRecords';

jest.mock('@/side-panel/hooks/useSearchableObjectNameSingulars', () => ({
  useSearchableObjectNameSingulars: () => ['person', 'company', 'opportunity'],
}));
jest.mock('@/object-record/hooks/useObjectRecordSearchRecords', () => ({
  useObjectRecordSearchRecords: jest.fn(() => ({
    loading: false,
    searchRecords: [],
  })),
}));

describe('navigation record search empty state', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest
      .mocked(useObjectRecordSearchRecords)
      .mockReturnValue({ loading: false, searchRecords: [], error: undefined });
  });
  afterEach(() => jest.useRealTimers());

  it('keeps loading between quick empty responses until the current search settles', () => {
    const { result, rerender } = renderHook(
      ({ searchInput }) =>
        useNavigationMenuItemSearchRecords({ searchInput, currentItems: [] }),
      { initialProps: { searchInput: '' } },
    );

    rerender({ searchInput: 'goo' });
    expect(result.current.recordSearchLoading).toBe(true);
    act(() => jest.advanceTimersByTime(300));
    expect(result.current.recordSearchLoading).toBe(true);

    act(() => jest.advanceTimersByTime(100));
    rerender({ searchInput: 'goog' });
    expect(result.current.recordSearchLoading).toBe(true);
    act(() => jest.advanceTimersByTime(300));
    expect(result.current.recordSearchLoading).toBe(true);
    act(() => jest.advanceTimersByTime(300));
    expect(result.current.recordSearchLoading).toBe(false);
    expect(result.current.navigationMenuItemSearchRecords).toEqual([]);
  });
});

describe('navigation record search duplicates', () => {
  it('keeps an existing record visible and only marks it unavailable in its section', () => {
    const record = {
      recordId: 'ivan',
      objectNameSingular: 'person',
      label: 'Ivan Zhao',
      imageUrl: null,
    };
    jest.mocked(useObjectRecordSearchRecords).mockReturnValue({
      loading: false,
      searchRecords: [
        { ...record, objectLabelSingular: 'Person', tsRankCD: 1, tsRank: 1 },
      ],
      error: undefined,
    });
    const existingItem: NavigationMenuItem = {
      id: 'navigation-ivan',
      type: NavigationMenuItemType.RECORD,
      targetRecordId: record.recordId,
      folderId: 'folder',
      position: 0,
      createdAt: '',
      updatedAt: '',
    };
    const { result, rerender } = renderHook(
      ({ currentItems }: { currentItems: NavigationMenuItem[] }) =>
        useNavigationMenuItemSearchRecords({
          searchInput: 'Ivan',
          currentItems,
        }),
      { initialProps: { currentItems: [existingItem] } },
    );
    expect(result.current.navigationMenuItemSearchRecords).toEqual([
      { ...record, isAlreadyInSidebar: true },
    ]);

    rerender({ currentItems: [] });
    expect(result.current.navigationMenuItemSearchRecords).toEqual([
      { ...record, isAlreadyInSidebar: false },
    ]);
  });
});

describe('navigation record search object filters', () => {
  it('searches selected readable objects and restores all objects when cleared', () => {
    const { rerender } = renderHook(
      ({ selectedObjectNameSingulars }) =>
        useNavigationMenuItemSearchRecords({
          searchInput: '',
          currentItems: [],
          selectedObjectNameSingulars,
        }),
      {
        initialProps: {
          selectedObjectNameSingulars: ['person', 'company', 'unreadable'],
        },
      },
    );
    expect(useObjectRecordSearchRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({
        objectNameSingulars: ['person', 'company'],
        skip: false,
      }),
    );
    rerender({ selectedObjectNameSingulars: ['opportunity'] });
    expect(useObjectRecordSearchRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({
        objectNameSingulars: ['opportunity'],
      }),
    );
    rerender({ selectedObjectNameSingulars: [] });
    expect(useObjectRecordSearchRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({
        objectNameSingulars: ['person', 'company', 'opportunity'],
      }),
    );
    rerender({ selectedObjectNameSingulars: ['unreadable'] });
    expect(useObjectRecordSearchRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({
        objectNameSingulars: [],
        skip: true,
      }),
    );
  });
});
