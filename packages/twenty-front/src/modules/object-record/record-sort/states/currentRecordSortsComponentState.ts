import { RecordSortsComponentInstanceContext } from '@/object-record/record-sort/states/context/RecordSortsComponentInstanceContext';
import { type RecordSort } from '@/object-record/record-sort/types/RecordSort';
import { createRecordFieldDependentComponentState } from '@/object-record/utils/createRecordFieldDependentComponentState';

export const currentRecordSortsComponentState =
  createRecordFieldDependentComponentState<RecordSort>({
    key: 'currentRecordSortsComponentState',
    defaultValue: [],
    componentInstanceContext: RecordSortsComponentInstanceContext,
  });
