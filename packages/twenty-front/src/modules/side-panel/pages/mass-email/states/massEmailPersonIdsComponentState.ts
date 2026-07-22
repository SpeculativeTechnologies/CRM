import { SidePanelPageComponentInstanceContext } from '@/side-panel/states/contexts/SidePanelPageComponentInstanceContext';
import { createAtomComponentState } from '@/ui/utilities/state/jotai/utils/createAtomComponentState';

export const massEmailPersonIdsComponentState = createAtomComponentState<
  string[]
>({
  key: 'side-panel/mass-email-person-ids',
  defaultValue: [],
  componentInstanceContext: SidePanelPageComponentInstanceContext,
});
