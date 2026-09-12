import { RecordFiltersComponentInstanceContext } from '@/object-record/record-filter/states/context/RecordFiltersComponentInstanceContext';
import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { createRecordFieldDependentComponentState } from '@/object-record/utils/createRecordFieldDependentComponentState';

export const currentRecordFiltersComponentState =
  createRecordFieldDependentComponentState<RecordFilter>({
    key: 'currentRecordFiltersComponentState',
    defaultValue: [],
    componentInstanceContext: RecordFiltersComponentInstanceContext,
  });
