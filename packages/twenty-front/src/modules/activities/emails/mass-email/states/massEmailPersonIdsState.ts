import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const massEmailPersonIdsState = createAtomState<string[]>({
  key: 'massEmailPersonIdsState',
  defaultValue: [],
  useSessionStorage: true,
});
