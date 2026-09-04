import { createAtomFamilyState } from '@/ui/utilities/state/jotai/utils/createAtomFamilyState';

export const viewFieldAggregateValueState = createAtomFamilyState<
  string | null | undefined,
  { viewFieldId: string }
>({
  key: 'viewFieldAggregateValueState',
  defaultValue: null,
});
