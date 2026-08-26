import { type TextColorName } from '@/advanced-text-editor/constants/TextColorNames';
import { type MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

export const TEXT_COLOR_LABELS = {
  gray: msg`Gray`,
  brown: msg`Brown`,
  red: msg`Red`,
  orange: msg`Orange`,
  yellow: msg`Yellow`,
  green: msg`Green`,
  turquoise: msg`Turquoise`,
  sky: msg`Sky`,
  blue: msg`Blue`,
  purple: msg`Purple`,
  pink: msg`Pink`,
} as const satisfies Record<TextColorName, MessageDescriptor>;
