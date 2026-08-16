import { DEFAULT_SIDE_PANEL_SEARCH_OBJECT_FILTER } from '@/side-panel/constants/DefaultSidePanelSearchObjectFilter';
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

// Selected object name singulars; an empty array means all objects.
export const sidePanelSearchObjectFilterState = createAtomState<string[]>({
  key: 'side-panel/sidePanelSearchObjectFilterState',
  defaultValue: DEFAULT_SIDE_PANEL_SEARCH_OBJECT_FILTER,
});
