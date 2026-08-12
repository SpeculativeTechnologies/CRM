import {
  StepLogicalOperator,
  ViewFilterOperand,
} from 'twenty-shared/types';

import { type DatabaseEventTriggerFilterSettings } from 'src/modules/workflow/workflow-trigger/automated-trigger/constants/automated-trigger-settings';
import { isKnownPersonCompanyInferenceFilter } from 'src/database/commands/upgrade-version-command/2-27/utils/is-known-person-company-inference-filter.util';

const sourceOnlyFilter: DatabaseEventTriggerFilterSettings = {
  stepFilterGroups: [
    { id: 'group', logicalOperator: StepLogicalOperator.AND },
  ],
  stepFilters: [
    {
      id: 'source',
      type: 'ACTOR',
      stepOutputKey: '{{trigger.properties.after.createdBy.source}}',
      operand: ViewFilterOperand.IS_NOT,
      value: '["EMAIL"]',
      stepFilterGroupId: 'group',
    },
  ],
};

const safeFilter: DatabaseEventTriggerFilterSettings = {
  stepFilterGroups: sourceOnlyFilter.stepFilterGroups,
  stepFilters: [
    ...sourceOnlyFilter.stepFilters,
    {
      id: 'company',
      type: 'RELATION',
      stepOutputKey: '{{trigger.properties.after.companyId}}',
      operand: ViewFilterOperand.IS_EMPTY,
      value: '',
      stepFilterGroupId: 'group',
    },
  ],
};

describe('isKnownPersonCompanyInferenceFilter', () => {
  it.each([undefined, { stepFilterGroups: [], stepFilters: [] }])(
    'accepts a default workflow with no effective filter',
    (filter) => {
      expect(
        isKnownPersonCompanyInferenceFilter({
          filter,
          sourceOnlyFilter,
          safeFilter,
        }),
      ).toBe(true);
    },
  );

  it.each([sourceOnlyFilter, safeFilter])(
    'accepts a known default filter state',
    (filter) => {
      expect(
        isKnownPersonCompanyInferenceFilter({
          filter,
          sourceOnlyFilter,
          safeFilter,
        }),
      ).toBe(true);
    },
  );

  it('rejects a customized filter', () => {
    const customFilter: DatabaseEventTriggerFilterSettings = {
      stepFilterGroups: [
        { id: 'custom-group', logicalOperator: StepLogicalOperator.AND },
      ],
      stepFilters: [
        {
          id: 'custom-filter',
          type: 'TEXT',
          stepOutputKey: '{{trigger.properties.after.jobTitle}}',
          operand: ViewFilterOperand.CONTAINS,
          value: 'Founder',
          stepFilterGroupId: 'custom-group',
        },
      ],
    };

    expect(
      isKnownPersonCompanyInferenceFilter({
        filter: customFilter,
        sourceOnlyFilter,
        safeFilter,
      }),
    ).toBe(false);
  });
});
