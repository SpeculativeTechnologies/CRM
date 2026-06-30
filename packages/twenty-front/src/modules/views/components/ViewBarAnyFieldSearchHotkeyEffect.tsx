import { useOpenDropdown } from '@/ui/layout/dropdown/hooks/useOpenDropdown';
import { useGlobalHotkeys } from '@/ui/utilities/hotkey/hooks/useGlobalHotkeys';
import { ViewBarFilterDropdownIds } from '@/views/constants/ViewBarFilterDropdownIds';
import { useOpenAnyFieldSearchFilterFromViewBar } from '@/views/hooks/useOpenAnyFieldSearchFilterFromViewBar';

// Cmd/Ctrl+F filters the current record view in place via the any-field search,
// instead of opening the browser's native find. This makes it quick to type a
// name, spot duplicates in the table, then checkbox and merge them.
export const ViewBarAnyFieldSearchHotkeyEffect = () => {
  const { openDropdown } = useOpenDropdown();

  const { openAnyFieldSearchFilterFromViewBar } =
    useOpenAnyFieldSearchFilterFromViewBar();

  useGlobalHotkeys({
    keys: ['meta+f', 'ctrl+f'],
    callback: () => {
      openDropdown({
        dropdownComponentInstanceIdFromProps: ViewBarFilterDropdownIds.MAIN,
      });

      // The filter dropdown resets its sub-state when it opens (onOpen), so defer
      // selecting the any-field search until after that effect has run.
      requestAnimationFrame(() => {
        openAnyFieldSearchFilterFromViewBar();
      });
    },
    containsModifier: true,
    dependencies: [openDropdown, openAnyFieldSearchFilterFromViewBar],
  });

  return null;
};
