import { TIPTAP_MARK_TYPES, type TipTapMarkType } from './tiptap-mark-types';

// Marks are applied in this order, so the first entry ends up innermost. Text
// colour goes first on purpose: its span then wins over the colour a
// surrounding link would otherwise impose on its own text.
export const TIPTAP_MARKS_RENDER_ORDER: readonly TipTapMarkType[] = [
  TIPTAP_MARK_TYPES.TEXT_COLOR,
  TIPTAP_MARK_TYPES.UNDERLINE,
  TIPTAP_MARK_TYPES.BOLD,
  TIPTAP_MARK_TYPES.ITALIC,
  TIPTAP_MARK_TYPES.STRIKE,
  TIPTAP_MARK_TYPES.LINK,
] as const;
