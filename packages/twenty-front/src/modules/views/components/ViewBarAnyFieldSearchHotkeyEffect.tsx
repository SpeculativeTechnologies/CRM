import { anyFieldFilterValueComponentState } from '@/object-record/record-filter/states/anyFieldFilterValueComponentState';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { useOpenDropdown } from '@/ui/layout/dropdown/hooks/useOpenDropdown';
import { useGlobalHotkeys } from '@/ui/utilities/hotkey/hooks/useGlobalHotkeys';
import { useHotkeysOnFocusedElement } from '@/ui/utilities/hotkey/hooks/useHotkeysOnFocusedElement';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { ViewBarFilterDropdownIds } from '@/views/constants/ViewBarFilterDropdownIds';
import { useOpenAnyFieldSearchFilterFromViewBar } from '@/views/hooks/useOpenAnyFieldSearchFilterFromViewBar';
import { Key } from 'ts-key-enum';

// Cmd/Ctrl+F filters the current record view in place via the any-field search,
// instead of opening the browser's native find. This makes it quick to type a
// name, spot duplicates in the table, then checkbox and merge them.
export const ViewBarAnyFieldSearchHotkeyEffect = () => {
  const { openDropdown } = useOpenDropdown();

  const { openAnyFieldSearchFilterFromViewBar } =
    useOpenAnyFieldSearchFilterFromViewBar();

  const { closeDropdown } = useCloseDropdown();

  const setAnyFieldFilterValue = useSetAtomComponentState(
    anyFieldFilterValueComponentState,
  );

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

  // Escape clears the search and closes the dropdown, resetting the view to show
  // every record. This handler is registered before the dropdown's own Escape
  // (which only closes), so it wins and must close the dropdown itself too.
  useHotkeysOnFocusedElement({
    keys: [Key.Escape],
    callback: () => {
      setAnyFieldFilterValue('');
      closeDropdown(ViewBarFilterDropdownIds.MAIN);
    },
    focusId: ViewBarFilterDropdownIds.MAIN,
    dependencies: [setAnyFieldFilterValue, closeDropdown],
  });

  return null;
};
