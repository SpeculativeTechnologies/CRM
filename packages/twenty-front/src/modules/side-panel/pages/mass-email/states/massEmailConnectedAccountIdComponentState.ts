import { SidePanelPageComponentInstanceContext } from '@/side-panel/states/contexts/SidePanelPageComponentInstanceContext';
import { createAtomComponentState } from '@/ui/utilities/state/jotai/utils/createAtomComponentState';

export const massEmailConnectedAccountIdComponentState =
  createAtomComponentState<string>({
    key: 'side-panel/mass-email-connected-account-id',
    defaultValue: '',
    componentInstanceContext: SidePanelPageComponentInstanceContext,
  });
