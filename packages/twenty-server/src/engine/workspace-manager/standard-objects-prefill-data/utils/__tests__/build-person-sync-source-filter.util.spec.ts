import {
  buildPersonCompanyInferenceFilter,
  buildPersonSyncSourceFilter,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/build-person-sync-source-filter.util';
import { evaluateStepFilters } from 'src/modules/workflow/workflow-executor/workflow-actions/filter/utils/evaluate-step-filters.util';

describe('buildPersonSyncSourceFilter', () => {
  const filter = buildPersonSyncSourceFilter({
    createdByFieldMetadataId: 'created-by-field-id',
  });

  const evaluateForSource = (source?: string) =>
    evaluateStepFilters({
      stepFilters: filter.stepFilters,
      stepFilterGroups: filter.stepFilterGroups,
      context: {
        trigger: {
          properties: {
            after: {
              createdBy: source === undefined ? {} : { source },
            },
          },
        },
      },
    });

  it('suppresses people auto-created by the email sync', () => {
    expect(evaluateForSource('EMAIL')).toBe(false);
  });

  it('suppresses people auto-created by the calendar sync', () => {
    expect(evaluateForSource('CALENDAR')).toBe(false);
  });

  it.each(['MANUAL', 'API', 'IMPORT', 'WORKFLOW', 'SYSTEM', 'WEBHOOK'])(
    'runs the workflow for people created via %s',
    (source) => {
      expect(evaluateForSource(source)).toBe(true);
    },
  );

  it('runs the workflow when the createdBy source is missing (fails open)', () => {
    expect(evaluateForSource(undefined)).toBe(true);
  });

  it('builds two ANDed source filters that reference the given field', () => {
    expect(filter.stepFilterGroups).toHaveLength(1);
    expect(filter.stepFilterGroups[0].logicalOperator).toBe('AND');

    expect(filter.stepFilters).toHaveLength(2);
    expect(
      filter.stepFilters.every(
        (stepFilter) =>
          stepFilter.fieldMetadataId === 'created-by-field-id' &&
          stepFilter.operand === 'IS_NOT' &&
          stepFilter.compositeFieldSubFieldName === 'source' &&
          stepFilter.stepFilterGroupId === filter.stepFilterGroups[0].id,
      ),
    ).toBe(true);
  });
});

describe('buildPersonCompanyInferenceFilter', () => {
  const filter = buildPersonCompanyInferenceFilter({
    createdByFieldMetadataId: 'created-by-field-id',
    companyFieldMetadataId: 'company-field-id',
  });

  const evaluateForPerson = ({
    source = 'MANUAL',
    companyId,
  }: {
    source?: string;
    companyId?: string | null;
  }) =>
    evaluateStepFilters({
      stepFilters: filter.stepFilters,
      stepFilterGroups: filter.stepFilterGroups,
      context: {
        trigger: {
          properties: {
            after: {
              createdBy: { source },
              companyId,
            },
          },
        },
      },
    });

  it.each([undefined, null, ''])(
    'runs when the person has no company (%s)',
    (companyId) => {
      expect(evaluateForPerson({ companyId })).toBe(true);
    },
  );

  it('does not run when the person already has a company', () => {
    expect(evaluateForPerson({ companyId: 'intentional-company-id' })).toBe(
      false,
    );
  });

  it.each(['EMAIL', 'CALENDAR'])(
    'does not run for people created by %s sync',
    (source) => {
      expect(evaluateForPerson({ source })).toBe(false);
    },
  );

  it('adds the company guard to the same AND group as the source guards', () => {
    expect(filter.stepFilterGroups).toHaveLength(1);
    expect(filter.stepFilters).toHaveLength(3);
    expect(filter.stepFilters[2]).toMatchObject({
      type: 'RELATION',
      operand: 'IS_EMPTY',
      value: '',
      stepOutputKey: '{{trigger.properties.after.companyId}}',
      fieldMetadataId: 'company-field-id',
      stepFilterGroupId: filter.stepFilterGroups[0].id,
    });
  });
});
