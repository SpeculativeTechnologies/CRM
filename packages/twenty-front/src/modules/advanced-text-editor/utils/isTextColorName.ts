import {
  TEXT_COLOR_NAMES,
  type TextColorName,
} from '@/advanced-text-editor/constants/TextColorNames';

export const isTextColorName = (value: unknown): value is TextColorName =>
  typeof value === 'string' &&
  (TEXT_COLOR_NAMES as readonly string[]).includes(value);
