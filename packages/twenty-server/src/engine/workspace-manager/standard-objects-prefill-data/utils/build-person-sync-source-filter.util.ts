import {
  FieldActorSource,
  type StepFilter,
  type StepFilterGroup,
  StepLogicalOperator,
  ViewFilterOperand,
} from 'twenty-shared/types';

const PERSON_SYNC_SOURCE_FILTER_GROUP_ID =
  '2d9c1f3a-6b4e-4c8a-9f12-7a3b5c6d8e90';

const PERSON_SYNC_SOURCE_EMAIL_FILTER_ID =
  '3e8b2a4c-7c5f-4d9b-8a23-6b4c5d7e9f01';

const PERSON_SYNC_SOURCE_CALENDAR_FILTER_ID =
  '4f9c3b5d-8d6a-4e0c-9b34-7c5d6e8f0a12';

const PERSON_COMPANY_EMPTY_FILTER_ID = '5a0d4c6e-9e7b-4f1d-8c45-8d6e7f9a1b23';

export const buildPersonSyncSourceFilter = ({
  createdByFieldMetadataId,
}: {
  createdByFieldMetadataId: string;
}): { stepFilterGroups: StepFilterGroup[]; stepFilters: StepFilter[] } => {
  const baseFilter = {
    type: 'ACTOR',
    operand: ViewFilterOperand.IS_NOT,
    stepOutputKey: '{{trigger.properties.after.createdBy.source}}',
    stepFilterGroupId: PERSON_SYNC_SOURCE_FILTER_GROUP_ID,
    compositeFieldSubFieldName: 'source',
    fieldMetadataId: createdByFieldMetadataId,
  };

  return {
    stepFilterGroups: [
      {
        id: PERSON_SYNC_SOURCE_FILTER_GROUP_ID,
        logicalOperator: StepLogicalOperator.AND,
      },
    ],
    stepFilters: [
      {
        ...baseFilter,
        id: PERSON_SYNC_SOURCE_EMAIL_FILTER_ID,
        value: JSON.stringify([FieldActorSource.EMAIL]),
        positionInStepFilterGroup: 0,
      },
      {
        ...baseFilter,
        id: PERSON_SYNC_SOURCE_CALENDAR_FILTER_ID,
        value: JSON.stringify([FieldActorSource.CALENDAR]),
        positionInStepFilterGroup: 1,
      },
    ],
  };
};

export const buildPersonCompanyInferenceFilter = ({
  createdByFieldMetadataId,
  companyFieldMetadataId,
}: {
  createdByFieldMetadataId: string;
  companyFieldMetadataId: string;
}): { stepFilterGroups: StepFilterGroup[]; stepFilters: StepFilter[] } => {
  const sourceFilter = buildPersonSyncSourceFilter({
    createdByFieldMetadataId,
  });

  return {
    stepFilterGroups: sourceFilter.stepFilterGroups,
    stepFilters: [
      ...sourceFilter.stepFilters,
      {
        id: PERSON_COMPANY_EMPTY_FILTER_ID,
        type: 'RELATION',
        operand: ViewFilterOperand.IS_EMPTY,
        value: '',
        stepOutputKey: '{{trigger.properties.after.companyId}}',
        stepFilterGroupId: PERSON_SYNC_SOURCE_FILTER_GROUP_ID,
        fieldMetadataId: companyFieldMetadataId,
        positionInStepFilterGroup: 2,
      },
    ],
  };
};
