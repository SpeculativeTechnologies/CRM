import isEqual from 'lodash.isequal';
import { isDefined, isNonEmptyArray } from 'twenty-shared/utils';

import { type DatabaseEventTriggerFilterSettings } from 'src/modules/workflow/workflow-trigger/automated-trigger/constants/automated-trigger-settings';

export const isKnownPersonCompanyInferenceFilter = ({
  filter,
  sourceOnlyFilter,
  safeFilter,
}: {
  filter: DatabaseEventTriggerFilterSettings | undefined;
  sourceOnlyFilter: DatabaseEventTriggerFilterSettings;
  safeFilter: DatabaseEventTriggerFilterSettings;
}): boolean =>
  !isDefined(filter) ||
  !isNonEmptyArray(filter.stepFilters) ||
  isEqual(filter, sourceOnlyFilter) ||
  isEqual(filter, safeFilter);
