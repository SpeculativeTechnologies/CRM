import { type AdvancedTextEditorProfile } from '@/advanced-text-editor/types/AdvancedTextEditorProfile';
import { buildFullRichTextExtensions } from '@/advanced-text-editor/utils/buildFullRichTextExtensions';
import { parseLegacyHtmlDocument } from '@/advanced-text-editor/utils/parseLegacyHtmlDocument';

// Deliberately the plain rich-text extension set, with neither variable tags
// nor the campaign block extensions: the signature has to be pasteable into
// every composer, so it may only use nodes all of their schemas accept.
export const EMAIL_SIGNATURE_EDITOR_PROFILE = {
  chrome: 'field',
  minHeight: 120,
  enableFullScreen: false,
  parseLegacyDocument: parseLegacyHtmlDocument,
  buildExtensions: buildFullRichTextExtensions,
} satisfies AdvancedTextEditorProfile;
