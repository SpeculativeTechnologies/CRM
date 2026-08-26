import { type TextColorName } from '@/advanced-text-editor/constants/TextColorNames';
import { TEXT_COLOR_MARK_NAME } from '@/advanced-text-editor/extensions/text-color/TextColorMark';
import { isTextColorName } from '@/advanced-text-editor/utils/isTextColorName';
import { type Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';

// A selection spanning several colours reports whichever the mark at the caret
// carries; an unrecognised stored name reads as no colour, matching what the
// editor and the outbound email actually render.
const readTextColor = (editor: Editor): TextColorName | undefined => {
  const { color } = editor.getAttributes(TEXT_COLOR_MARK_NAME);

  return isTextColorName(color) ? color : undefined;
};

export const useTextBubbleState = (editor: Editor) => {
  const state = useEditorState({
    editor,
    selector: (ctx) => {
      return {
        isBold: ctx.editor.isActive('bold'),
        isItalic: ctx.editor.isActive('italic'),
        isStrike: ctx.editor.isActive('strike'),
        isUnderline: ctx.editor.isActive('underline'),
        isLink: ctx.editor.isActive('link'),
        linkHref: ctx.editor.getAttributes('link').href || '',
        isBulletList: ctx.editor.isActive('bulletList'),
        isOrderedList: ctx.editor.isActive('orderedList'),
        textColor: readTextColor(ctx.editor),
      };
    },
  });

  return state;
};
