import { type ReactNode } from 'react';
import {
  resolveTipTapTextColor,
  type TextColorMarkAttributes,
  type TipTapMark,
} from 'twenty-shared/utils';

// The document stores a palette name; mail clients need a literal colour on an
// inline style, so the name is resolved here. An unknown name renders the text
// with no colour at all rather than passing the stored value through as CSS.
export const textColor = (mark: TipTapMark, children: ReactNode): ReactNode => {
  const { color } = (mark.attrs as TextColorMarkAttributes | undefined) ?? {};
  const resolvedColor = resolveTipTapTextColor(color);

  if (resolvedColor === undefined) {
    return children;
  }

  return <span style={{ color: resolvedColor }}>{children}</span>;
};
