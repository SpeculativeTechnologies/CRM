import { TEXT_COLOR_NAMES } from '@/advanced-text-editor/constants/TextColorNames';
import { getTextColorCssVariable } from '@/advanced-text-editor/utils/getTextColorCssVariable';
import { themeCssVariables } from 'twenty-ui/theme-constants';

describe('getTextColorCssVariable', () => {
  // Resolving through the tag token is what makes a swatch readable in dark
  // mode as well as light: a literal colour could only ever suit one of them.
  it('should resolve every swatch to a themed tag text token', () => {
    for (const colorName of TEXT_COLOR_NAMES) {
      expect(getTextColorCssVariable(colorName)).toBe(
        themeCssVariables.tag.text[colorName],
      );
      expect(getTextColorCssVariable(colorName)).toMatch(
        /^var\(--t-tag-text-[a-z]+\)$/,
      );
    }
  });
});
