import { computeRecordGqlOperationFilter } from '../computeRecordGqlOperationFilter';
import type { RecordFilter } from '../turnRecordFilterGroupIntoGqlOperationFilter';

import { FieldMetadataType } from '@/types/FieldMetadataType';
import type { PartialFieldMetadataItem } from '@/types/PartialFieldMetadataItem';
import { ViewFilterOperand } from '@/types/ViewFilterOperand';

describe('computeRecordGqlOperationFilter', () => {
  it('should match Is UUID', () => {
    const companyIdField: PartialFieldMetadataItem = {
      id: 'company-id-field',
      name: 'id',
      label: 'ID',
      type: FieldMetadataType.UUID,
    };

    const uuidValue = '4f83d5c0-7c7a-4f67-9f29-0a6aad1f4eb1';

    const recordFilters: RecordFilter[] = [
      {
        id: 'uuid-filter',
        fieldMetadataId: companyIdField.id,
        value: uuidValue,
        type: 'UUID',
        operand: ViewFilterOperand.IS,
      },
    ];

    const filter = computeRecordGqlOperationFilter({
      fieldMetadataItems: [companyIdField],
      recordFilters,
      recordFilterGroups: [],
      filterValueDependencies: {
        timeZone: 'UTC',
      },
    });

    expect(filter).toEqual({
      id: {
        in: [uuidValue],
      },
    });
  });

  it('should combine two numeric filters on the same field into an AND range', () => {
    const lifetimeDonationsField: PartialFieldMetadataItem = {
      id: 'lifetime-donations-field',
      name: 'lifetimeDonations',
      label: 'Lifetime Donations',
      type: FieldMetadataType.NUMBER,
    };
    const recordFilters: RecordFilter[] = [
      {
        id: 'lower-bound-filter',
        fieldMetadataId: lifetimeDonationsField.id,
        value: '100',
        type: 'NUMBER',
        operand: ViewFilterOperand.GREATER_THAN_OR_EQUAL,
      },
      {
        id: 'upper-bound-filter',
        fieldMetadataId: lifetimeDonationsField.id,
        value: '500',
        type: 'NUMBER',
        operand: ViewFilterOperand.LESS_THAN_OR_EQUAL,
      },
    ];

    const filter = computeRecordGqlOperationFilter({
      fieldMetadataItems: [lifetimeDonationsField],
      recordFilters,
      recordFilterGroups: [],
      filterValueDependencies: {
        timeZone: 'UTC',
      },
    });

    expect(filter).toEqual({
      and: [
        {
          lifetimeDonations: {
            gte: 100,
          },
        },
        {
          lifetimeDonations: {
            lte: 500,
          },
        },
      ],
    });
  });
});
