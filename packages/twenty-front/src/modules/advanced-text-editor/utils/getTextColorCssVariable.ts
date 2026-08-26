import { type TextColorName } from '@/advanced-text-editor/constants/TextColorNames';
import { themeCssVariables } from 'twenty-ui/theme-constants';

// The tag text tokens are declared for both themes, so the same variable
// resolves to a readable colour whichever one is active.
export const getTextColorCssVariable = (colorName: TextColorName): string =>
  themeCssVariables.tag.text[colorName];
