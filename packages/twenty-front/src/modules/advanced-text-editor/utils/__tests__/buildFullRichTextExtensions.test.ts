import { CAMPAIGN_BODY_EDITOR_PROFILE } from '@/activities/emails/editor/constants/CampaignBodyEditorProfile';
import { INLINE_EMAIL_BODY_EDITOR_PROFILE } from '@/activities/emails/editor/constants/InlineEmailBodyEditorProfile';
import { EMAIL_SIGNATURE_EDITOR_PROFILE } from '@/activities/emails/signature/constants/EmailSignatureEditorProfile';
import { TEXT_COLOR_MARK_NAME } from '@/advanced-text-editor/extensions/text-color/TextColorMark';
import { buildFullRichTextExtensions } from '@/advanced-text-editor/utils/buildFullRichTextExtensions';

describe('buildFullRichTextExtensions', () => {
  it('should include the text colour mark', () => {
    expect(
      buildFullRichTextExtensions({}).map((extension) => extension.name),
    ).toContain(TEXT_COLOR_MARK_NAME);
  });

  // A signature is inserted into composer documents as blocks, so a mark the
  // composer schema does not know would be dropped on the way in. Every
  // composer that can receive a signature has to share the mark with it.
  it.each([
    ['signature', EMAIL_SIGNATURE_EDITOR_PROFILE],
    ['inline email body', INLINE_EMAIL_BODY_EDITOR_PROFILE],
    ['campaign body', CAMPAIGN_BODY_EDITOR_PROFILE],
  ])('should give the %s editor the text colour mark', (_label, profile) => {
    expect(
      profile.buildExtensions({}).map((extension) => extension.name),
    ).toContain(TEXT_COLOR_MARK_NAME);
  });
});
