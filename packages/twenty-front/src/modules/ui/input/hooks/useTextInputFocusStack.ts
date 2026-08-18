import { useCallback, useEffect } from 'react';

import { usePushFocusItemToFocusStack } from '@/ui/utilities/focus/hooks/usePushFocusItemToFocusStack';
import { useRemoveFocusItemFromFocusStackById } from '@/ui/utilities/focus/hooks/useRemoveFocusItemFromFocusStackById';
import { FocusComponentType } from '@/ui/utilities/focus/types/FocusComponentType';

// Raw <input> elements are not registered in the focus stack, so global
// single-key hotkeys such as "/", "@" and "?" still fire while typing and
// swallow the character. Spread these handlers on any raw text input.
export const useTextInputFocusStack = ({ focusId }: { focusId: string }) => {
  const { pushFocusItemToFocusStack } = usePushFocusItemToFocusStack();
  const { removeFocusItemFromFocusStackById } =
    useRemoveFocusItemFromFocusStackById();

  const handleFocus = useCallback(() => {
    pushFocusItemToFocusStack({
      focusId,
      component: {
        type: FocusComponentType.TEXT_INPUT,
        instanceId: focusId,
      },
      globalHotkeysConfig: {
        enableGlobalHotkeysConflictingWithKeyboard: false,
      },
    });
  }, [focusId, pushFocusItemToFocusStack]);

  const handleBlur = useCallback(() => {
    removeFocusItemFromFocusStackById({ focusId });
  }, [focusId, removeFocusItemFromFocusStackById]);

  useEffect(
    () => () => removeFocusItemFromFocusStackById({ focusId }),
    [focusId, removeFocusItemFromFocusStackById],
  );

  return { handleFocus, handleBlur };
};
