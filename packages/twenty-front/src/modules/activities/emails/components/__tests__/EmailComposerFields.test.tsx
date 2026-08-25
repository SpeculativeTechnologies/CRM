import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';

import { EmailComposerFields } from '@/activities/emails/components/EmailComposerFields';
import { useEmailComposerState } from '@/activities/emails/hooks/useEmailComposerState';
import { GET_MY_CONNECTED_ACCOUNTS } from '@/settings/accounts/graphql/queries/getMyConnectedAccounts';
import { getJestMetadataAndApolloMocksWrapper } from '~/testing/jest/getJestMetadataAndApolloMocksWrapper';

const mockSendEmail = jest.fn();

jest.mock('@/activities/emails/hooks/useSendEmail', () => ({
  useSendEmail: () => ({ sendEmail: mockSendEmail, loading: false }),
}));

// The local twenty-ui build predates Field, and the front test runner resolves
// twenty-ui through its dist bundle, so the real container cannot mount here.
// It is a plain layout wrapper, which makes a bare div an accurate stand-in.
jest.mock('@/ui/input/components/FormFieldInputContainer', () => ({
  FormFieldInputContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

// The body editor is a rich text editor that brings no value to a subject
// field assertion, and mounting it in jsdom is expensive.
jest.mock(
  '@/advanced-text-editor/components/FormAdvancedTextFieldInput',
  () => ({
    FormAdvancedTextFieldInput: ({ placeholder }: { placeholder: string }) => (
      <div>{placeholder}</div>
    ),
  }),
);

// The composer only needs the account list to offer a sender picker, and the
// harness passes the connected account id directly. An empty list keeps the
// single-sender layout the issue was reported against.
const connectedAccountsMock = {
  request: { query: GET_MY_CONNECTED_ACCOUNTS },
  result: { data: { myConnectedAccounts: [] } },
};

const ComposerTestHarness = () => {
  const composerState = useEmailComposerState({
    connectedAccountId: 'account-1',
    defaultTo: 'grace@hopper.com',
  });

  return (
    <>
      <EmailComposerFields composerState={composerState} />
      <button type="button" onClick={composerState.handleSend}>
        Send
      </button>
    </>
  );
};

const renderComposer = () => {
  const Wrapper = getJestMetadataAndApolloMocksWrapper({
    apolloMocks: [connectedAccountsMock],
  });

  return render(
    <Wrapper>
      <I18nProvider i18n={i18n}>
        <ComposerTestHarness />
      </I18nProvider>
    </Wrapper>,
  );
};

describe('EmailComposerFields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendEmail.mockResolvedValue({
      success: true,
      messageThreadId: 'message-thread-1',
    });
  });

  it('should show a subject placeholder so the empty field is visible', async () => {
    renderComposer();

    expect(
      await screen.findByPlaceholderText('Add a subject'),
    ).toBeInTheDocument();
  });

  it('should focus the subject input when the subject label is clicked', async () => {
    renderComposer();

    const subjectInput = await screen.findByRole('textbox', {
      name: 'Subject',
    });

    await userEvent.click(screen.getByText('Subject'));

    expect(subjectInput).toHaveFocus();
  });

  it('should keep the typed subject when the Cc and Bcc fields open', async () => {
    renderComposer();

    const subjectInput = await screen.findByRole('textbox', {
      name: 'Subject',
    });

    await userEvent.type(subjectInput, 'Quarterly update');
    await userEvent.click(screen.getByRole('button', { name: 'Cc/Bcc' }));

    expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue(
      'Quarterly update',
    );
  });

  it('should send the typed subject when emailing a single recipient', async () => {
    renderComposer();

    const subjectInput = await screen.findByRole('textbox', {
      name: 'Subject',
    });

    await userEvent.type(subjectInput, 'Quarterly update');

    expect(subjectInput).toHaveValue('Quarterly update');

    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'grace@hopper.com',
          subject: 'Quarterly update',
        }),
      );
    });
  });
});
