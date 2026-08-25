import { type ViewFilter } from '@/views/types/ViewFilter';
import { ViewFilterOperand } from 'twenty-shared/types';
import { getViewFiltersToCreate } from '@/views/utils/getViewFiltersToCreate';

describe('getViewFiltersToCreate', () => {
  const baseFilter: ViewFilter = {
    id: 'filter-1',
    fieldMetadataId: 'field-1',
    operand: ViewFilterOperand.CONTAINS,
    value: 'test',
    displayValue: 'test',
    viewFilterGroupId: 'group-1',
    positionInViewFilterGroup: 0,
  };

  it('should return all filters when current filters array is empty', () => {
    const currentViewFilters: ViewFilter[] = [];
    const newViewFilters: ViewFilter[] = [
      { ...baseFilter } satisfies ViewFilter,
      {
        ...baseFilter,
        id: 'filter-2',
      } satisfies ViewFilter,
    ];

    const result = getViewFiltersToCreate(currentViewFilters, newViewFilters);

    expect(result).toEqual(newViewFilters);
  });

  it('should return empty array when new filters array is empty', () => {
    const currentViewFilters: ViewFilter[] = [baseFilter];
    const newViewFilters: ViewFilter[] = [];

    const result = getViewFiltersToCreate(currentViewFilters, newViewFilters);

    expect(result).toEqual([]);
  });

  it('should return only filters that do not exist in current filters', () => {
    const existingFilter = { ...baseFilter };
    const newFilterWithDifferentFieldMetadata = {
      ...baseFilter,
      id: 'filter-2',
    } satisfies ViewFilter;

    const currentViewFilters: ViewFilter[] = [existingFilter];

    const newViewFilters: ViewFilter[] = [
      existingFilter,
      newFilterWithDifferentFieldMetadata,
    ];

    const result = getViewFiltersToCreate(currentViewFilters, newViewFilters);

    expect(result).toEqual([newFilterWithDifferentFieldMetadata]);
  });

  it('should persist a second numeric condition on the same field', () => {
    const lowerBoundFilter = {
      ...baseFilter,
      id: 'lower-bound-filter',
      operand: ViewFilterOperand.GREATER_THAN_OR_EQUAL,
      value: '100',
      viewFilterGroupId: null,
    } satisfies ViewFilter;
    const upperBoundFilter = {
      ...baseFilter,
      id: 'upper-bound-filter',
      operand: ViewFilterOperand.LESS_THAN_OR_EQUAL,
      value: '500',
      viewFilterGroupId: null,
    } satisfies ViewFilter;

    const result = getViewFiltersToCreate(
      [lowerBoundFilter],
      [lowerBoundFilter, upperBoundFilter],
    );

    expect(result).toEqual([upperBoundFilter]);
  });

  it('should handle empty arrays for both inputs', () => {
    const currentViewFilters: ViewFilter[] = [];
    const newViewFilters: ViewFilter[] = [];

    const result = getViewFiltersToCreate(currentViewFilters, newViewFilters);

    expect(result).toEqual([]);
  });
});
