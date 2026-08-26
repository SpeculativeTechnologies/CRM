// Text colour is offered as the CRM's own tag palette rather than as a free
// colour picker, so a swatch is stored as a theme colour name instead of a
// colour value. The editor resolves that name to the light or dark tag token
// and stays readable in either theme; a sent email has no theme, so the
// outbound renderer resolves the same name to the sRGB rendition of the light
// tag text token below.
//
// The values are the sRGB siblings of the display-p3 `tag.text.<name>` theme
// tokens (Radix step 11), because mail clients understand neither CSS custom
// properties nor the display-p3 colour space.
//
// Keep the names in sync with TEXT_COLOR_NAMES in twenty-front
// (src/modules/advanced-text-editor/constants/TextColorPalette.ts). Both sides
// pin the same list in their tests, so dropping a colour on one side fails the
// other side's test.
export const TIPTAP_TEXT_COLORS = {
  gray: '#666666',
  brown: '#815e46',
  red: '#ce2c31',
  orange: '#cc4e00',
  yellow: '#9e6c00',
  green: '#218358',
  turquoise: '#008573',
  sky: '#00749e',
  blue: '#3a5bc7',
  purple: '#8145b5',
  pink: '#c2298a',
} as const satisfies Readonly<Record<string, string>>;

export type TipTapTextColorName = keyof typeof TIPTAP_TEXT_COLORS;

export const TIPTAP_TEXT_COLOR_NAMES = Object.keys(
  TIPTAP_TEXT_COLORS,
) as TipTapTextColorName[];

export const isTipTapTextColorName = (
  value: unknown,
): value is TipTapTextColorName =>
  typeof value === 'string' &&
  Object.prototype.hasOwnProperty.call(TIPTAP_TEXT_COLORS, value);

// Resolving is the only place a stored value becomes CSS, so an unknown or
// hostile name yields nothing at all and the text renders in the inherited
// colour rather than carrying an attacker-chosen style declaration.
export const resolveTipTapTextColor = (value: unknown): string | undefined =>
  isTipTapTextColorName(value) ? TIPTAP_TEXT_COLORS[value] : undefined;
