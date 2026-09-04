import { buildSelectValueAggregateFilter } from '@/object-record/record-table/record-table-footer/utils/buildSelectValueAggregateFilter';
import { FieldMetadataType } from '~/generated-metadata/graphql';

describe('buildSelectValueAggregateFilter', () => {
  it('should filter a select field by the selected value', () => {
    expect(
      buildSelectValueAggregateFilter({
        fieldName: 'status',
        fieldMetadataType: FieldMetadataType.SELECT,
        aggregateValue: 'QUALIFIED',
      }),
    ).toEqual({ status: { eq: 'QUALIFIED' } });
  });

  it('should filter a multi-select field when it contains the selected value', () => {
    expect(
      buildSelectValueAggregateFilter({
        fieldName: 'tags',
        fieldMetadataType: FieldMetadataType.MULTI_SELECT,
        aggregateValue: 'PARTNER',
      }),
    ).toEqual({ tags: { containsAny: ['PARTNER'] } });
  });

  it('should not add a value filter for unsupported field types', () => {
    expect(
      buildSelectValueAggregateFilter({
        fieldName: 'name',
        fieldMetadataType: FieldMetadataType.TEXT,
        aggregateValue: 'Acme',
      }),
    ).toEqual({});
  });
});
