import { type TextColorName } from '@/advanced-text-editor/constants/TextColorNames';
import { TEXT_COLOR_MARK_NAME } from '@/advanced-text-editor/extensions/text-color/TextColorMark';
import { useLiveEditorState } from '@/advanced-text-editor/hooks/useLiveEditorState';
import { isTextColorName } from '@/advanced-text-editor/utils/isTextColorName';
import { type Editor } from '@tiptap/core';

// A selection spanning several colours reports whichever the mark at the caret
// carries; an unrecognised stored name reads as no colour, matching what the
// editor and the outbound email actually render.
const readTextColor = (editor: Editor): TextColorName | undefined => {
  const { color } = editor.getAttributes(TEXT_COLOR_MARK_NAME);

  return isTextColorName(color) ? color : undefined;
};

export const useTextBubbleState = (editor: Editor) => {
  const state = useLiveEditorState(editor, (currentEditor) => {
    return {
      isBold: currentEditor.isActive('bold'),
      isItalic: currentEditor.isActive('italic'),
      isStrike: currentEditor.isActive('strike'),
      isUnderline: currentEditor.isActive('underline'),
      isLink: currentEditor.isActive('link'),
      linkHref: currentEditor.getAttributes('link').href || '',
      isBulletList: currentEditor.isActive('bulletList'),
      isOrderedList: currentEditor.isActive('orderedList'),
      textColor: readTextColor(currentEditor),
    };
  });

  return state;
};
