import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CampaignComposerFields } from '@/activities/emails/components/CampaignComposerFields';
import { type useCampaignComposerState } from '@/activities/emails/hooks/useCampaignComposerState';

jest.mock('@/activities/emails/hooks/useCampaignAudiencePreview', () => ({
  useCampaignAudiencePreview: () => ({ audiencePreview: undefined }),
}));
jest.mock('@/activities/emails/hooks/useUnsubscribeTopics', () => ({
  useUnsubscribeTopics: () => ({ unsubscribeTopics: [] }),
}));
jest.mock('@/settings/accounts/hooks/useMyMessageChannels', () => ({
  useMyMessageChannels: () => ({ channels: [] }),
}));
jest.mock('@/object-record/hooks/useCreateOneRecord', () => ({
  useCreateOneRecord: () => ({ createOneRecord: jest.fn() }),
}));
jest.mock('@/ui/input/hooks/useTextInputFocusStack', () => ({
  useTextInputFocusStack: () => ({
    handleFocus: jest.fn(),
    handleBlur: jest.fn(),
  }),
}));
jest.mock(
  '@/activities/emails/templates/components/EmailTemplatesButton',
  () => ({ EmailTemplatesButton: () => null }),
);
jest.mock('@/ui/input/components/Select', () => ({ Select: () => null }));
jest.mock(
  '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker',
  () => ({ FormSingleRecordPicker: () => null }),
);
jest.mock(
  '@/advanced-text-editor/components/FormAdvancedTextFieldInput',
  () => ({ FormAdvancedTextFieldInput: () => null }),
);

describe('CampaignComposerFields subject', () => {
  const setSubject = jest.fn();
  const state = {
    subject: 'Welcome {{firstName}}',
    body: '',
    setSubject,
    isSignatureToggleVisible: false,
  } as unknown as ReturnType<typeof useCampaignComposerState>;

  it('should display personalization without requiring a workflow instance', () => {
    const { rerender } = render(
      <CampaignComposerFields campaignState={state} />,
    );

    expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue(
      'Welcome {{firstName}}',
    );
    rerender(
      <CampaignComposerFields
        campaignState={{ ...state, subject: 'Hello {{fullName}}' }}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue(
      'Hello {{fullName}}',
    );
  });

  it('should keep personalization while the subject is edited', async () => {
    render(<CampaignComposerFields campaignState={state} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Subject' }), '!');
    expect(setSubject).toHaveBeenCalledWith('Welcome {{firstName}}!');
  });
});
