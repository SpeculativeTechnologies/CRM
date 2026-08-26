import { TEXT_COLOR_LABELS } from '@/advanced-text-editor/constants/TextColorLabels';
import { TEXT_COLOR_NAMES } from '@/advanced-text-editor/constants/TextColorNames';
import { isTextColorName } from '@/advanced-text-editor/utils/isTextColorName';

// The same list is pinned by tiptap-text-colors.test.ts in twenty-shared, which
// holds the colour the outbound email renderer uses for each of these names.
const OFFERED_COLOR_NAMES = [
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
];

describe('isTextColorName', () => {
  it('should offer exactly the palette the outbound renderer knows', () => {
    expect([...TEXT_COLOR_NAMES]).toEqual(OFFERED_COLOR_NAMES);
  });

  it('should name every swatch', () => {
    for (const colorName of TEXT_COLOR_NAMES) {
      expect(TEXT_COLOR_LABELS[colorName]).toBeDefined();
    }
  });

  it('should recognise every offered swatch', () => {
    for (const colorName of TEXT_COLOR_NAMES) {
      expect(isTextColorName(colorName)).toBe(true);
    }
  });

  // A theme colour the picker does not offer is rejected like any other
  // unknown value, so the two sides of the palette cannot drift apart quietly.
  it('should not recognise a theme colour outside the palette', () => {
    expect(isTextColorName('crimson')).toBe(false);
    expect(isTextColorName('lime')).toBe(false);
  });

  it('should not recognise anything that is not a bare palette name', () => {
    expect(isTextColorName('chartreuse')).toBe(false);
    expect(isTextColorName('red; color: white')).toBe(false);
    expect(isTextColorName('color(display-p3 1 0 0)')).toBe(false);
    expect(isTextColorName(null)).toBe(false);
    expect(isTextColorName(undefined)).toBe(false);
    expect(isTextColorName(42)).toBe(false);
  });
});
