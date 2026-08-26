import { type TextColorName } from '@/advanced-text-editor/constants/TextColorNames';
import { getTextColorCssVariable } from '@/advanced-text-editor/utils/getTextColorCssVariable';
import { isTextColorName } from '@/advanced-text-editor/utils/isTextColorName';
import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textColor: {
      setTextColor: (colorName: TextColorName) => ReturnType;
      unsetTextColor: () => ReturnType;
    };
  }
}

export const TEXT_COLOR_MARK_NAME = 'textColor';

const TEXT_COLOR_DATA_ATTRIBUTE = 'data-text-color';

// Text colour is a mark on the shared rich-text extension set rather than a
// signature-only extension: a signature is pasted into composer documents, and
// a mark those schemas did not know would be stripped on the way in.
export const TextColorMark = Mark.create({
  name: TEXT_COLOR_MARK_NAME,

  addAttributes: () => ({
    // The palette name is what is stored. The editor renders it through the
    // theme variable so it follows light and dark mode, while the outbound
    // email renderer maps the same name to a literal colour for mail clients.
    color: {
      default: null,
      parseHTML: (element) => {
        const colorName = element.getAttribute(TEXT_COLOR_DATA_ATTRIBUTE);

        return isTextColorName(colorName) ? colorName : null;
      },
      renderHTML: (attributes) => {
        const colorName: unknown = attributes.color;

        if (!isTextColorName(colorName)) {
          return {};
        }

        return {
          [TEXT_COLOR_DATA_ATTRIBUTE]: colorName,
          style: `color: ${getTextColorCssVariable(colorName)}`,
        };
      },
    },
  }),

  // Documents written before this mark existed carry no such span, so they
  // parse exactly as they did before and keep the inherited colour.
  parseHTML: () => [
    {
      tag: `span[${TEXT_COLOR_DATA_ATTRIBUTE}]`,
      getAttrs: (element) =>
        isTextColorName(element.getAttribute(TEXT_COLOR_DATA_ATTRIBUTE))
          ? null
          : false,
    },
  ],

  renderHTML: ({ HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes),
    0,
  ],

  addCommands: () => ({
    setTextColor:
      (colorName: TextColorName) =>
      ({ commands }) =>
        commands.setMark(TEXT_COLOR_MARK_NAME, { color: colorName }),
    // Removing the mark rather than setting an explicit black keeps the text
    // following whichever colour its surroundings define.
    unsetTextColor:
      () =>
      ({ commands }) =>
        commands.unsetMark(TEXT_COLOR_MARK_NAME),
  }),
});
