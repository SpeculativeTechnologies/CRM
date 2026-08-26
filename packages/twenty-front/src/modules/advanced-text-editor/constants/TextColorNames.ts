// A fixed set of swatches taken from the tag palette the CRM already uses for
// chips and statuses, rather than a free colour picker. A swatch is stored as a
// theme colour name, not as a colour value: resolving the name through the
// theme is what keeps every swatch readable in light and in dark mode, where a
// stored colour could only ever suit one of them.
//
// Keep in sync with TIPTAP_TEXT_COLORS in twenty-shared
// (src/utils/tiptap/tiptap-text-colors.ts), which holds the fixed colour the
// outbound email renderer uses for the same names. Both sides pin this list in
// their tests, so a colour added or dropped on one side fails the other side.
export const TEXT_COLOR_NAMES = [
  'gray',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'turquoise',
  'sky',
  'blue',
  'purple',
  'pink',
] as const;

export type TextColorName = (typeof TEXT_COLOR_NAMES)[number];
