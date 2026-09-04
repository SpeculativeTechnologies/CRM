import { type RecordGqlOperationFilter } from 'twenty-shared/types';
import { FieldMetadataType } from '~/generated-metadata/graphql';

export const buildSelectValueAggregateFilter = ({
  fieldName,
  fieldMetadataType,
  aggregateValue,
}: {
  fieldName: string;
  fieldMetadataType: FieldMetadataType;
  aggregateValue: string;
}): RecordGqlOperationFilter => {
  if (fieldMetadataType === FieldMetadataType.SELECT) {
    return {
      [fieldName]: {
        eq: aggregateValue,
      },
    };
  }

  if (fieldMetadataType === FieldMetadataType.MULTI_SELECT) {
    return {
      [fieldName]: {
        containsAny: [aggregateValue],
      },
    };
  }

  return {};
};
