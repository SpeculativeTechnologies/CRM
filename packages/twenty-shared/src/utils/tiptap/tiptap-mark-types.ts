export const TIPTAP_MARK_TYPES = {
  BOLD: 'bold',
  ITALIC: 'italic',
  UNDERLINE: 'underline',
  STRIKE: 'strike',
  LINK: 'link',
  TEXT_COLOR: 'textColor',
} as const;

export type TipTapMarkType =
  (typeof TIPTAP_MARK_TYPES)[keyof typeof TIPTAP_MARK_TYPES];

export interface LinkMarkAttributes {
  href?: string;
  target?: string;
  rel?: string;
}

// A palette name such as 'blue', never a colour value: see tiptap-text-colors.
export interface TextColorMarkAttributes {
  color?: string | null;
}

export interface TipTapMark {
  type: TipTapMarkType;
  attrs?: LinkMarkAttributes | Record<string, unknown>;
}
