import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as JotaiProvider } from 'jotai';
import {
  TIPTAP_DOCUMENT_SCHEMA_VERSION,
  type TipTapNode,
} from 'twenty-shared/utils';

import {
  type CurrentWorkspaceMember,
  currentWorkspaceMemberState,
} from '@/auth/states/currentWorkspaceMemberState';
import { SettingsProfileEmailSignature } from '@/settings/profile/components/SettingsProfileEmailSignature';
import { useUpdateWorkspaceMemberSettings } from '@/settings/profile/hooks/useUpdateWorkspaceMemberSettings';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';

// The real editor mounts TipTap, which is not what this section's behaviour is
// about: it stands in for a plain text area emitting serialized documents.
jest.mock(
  '@/advanced-text-editor/components/FormAdvancedTextFieldInput',
  () => ({
    FormAdvancedTextFieldInput: ({
      defaultValue,
      onChange,
    }: {
      defaultValue: string | null | undefined;
      onChange?: (value: string) => void;
    }) => (
      // oxlint-disable-next-line twenty/require-text-input-focus-handlers -- a test double for the editor, not a real composer input
      <textarea
        aria-label="Email signature editor"
        defaultValue={defaultValue ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
      />
    ),
  }),
);

jest.mock('@/settings/profile/hooks/useUpdateWorkspaceMemberSettings', () => ({
  useUpdateWorkspaceMemberSettings: jest.fn(),
}));

const mockedUseUpdateWorkspaceMemberSettings = jest.mocked(
  useUpdateWorkspaceMemberSettings,
);
const updateWorkspaceMemberSettingsMock = jest.fn();

const serializeDocument = (content: TipTapNode[]): string =>
  JSON.stringify({
    type: 'doc',
    attrs: { schemaVersion: TIPTAP_DOCUMENT_SCHEMA_VERSION },
    content,
  });

const SIGNATURE = serializeDocument([
  { type: 'paragraph', content: [{ type: 'text', text: 'Ada Lovelace' }] },
]);

const setCurrentWorkspaceMember = ({
  emailSignature,
  isEmailSignatureIncludedByDefault,
}: {
  emailSignature: string | null;
  isEmailSignatureIncludedByDefault: boolean;
}) => {
  jotaiStore.set(currentWorkspaceMemberState.atom, {
    id: 'workspace-member-1',
    name: { firstName: 'Ada', lastName: 'Lovelace' },
    locale: 'en',
    colorScheme: 'Light',
    userEmail: 'ada@example.com',
    avatarUrl: null,
    emailSignature,
    isEmailSignatureIncludedByDefault,
  } as unknown as CurrentWorkspaceMember);
};

const renderSection = () =>
  render(
    <I18nProvider i18n={i18n}>
      <JotaiProvider store={jotaiStore}>
        <SettingsProfileEmailSignature />
      </JotaiProvider>
    </I18nProvider>,
  );

describe('SettingsProfileEmailSignature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateWorkspaceMemberSettingsMock.mockResolvedValue(undefined);
    mockedUseUpdateWorkspaceMemberSettings.mockReturnValue({
      updateWorkspaceMemberSettings: updateWorkspaceMemberSettingsMock,
    });
  });

  it('should show the stored signature', () => {
    setCurrentWorkspaceMember({
      emailSignature: SIGNATURE,
      isEmailSignatureIncludedByDefault: false,
    });

    renderSection();

    expect(screen.getByLabelText('Email signature editor')).toHaveValue(
      SIGNATURE,
    );
  });

  it('should keep the default-on preference off until the user turns it on', async () => {
    setCurrentWorkspaceMember({
      emailSignature: SIGNATURE,
      isEmailSignatureIncludedByDefault: false,
    });

    const { container } = renderSection();

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');

    const toggleInput = container.querySelector('input[type="checkbox"]');

    if (toggleInput === null) {
      throw new Error('Expected the toggle to render a checkbox input');
    }

    await userEvent.click(toggleInput);

    await waitFor(() =>
      expect(updateWorkspaceMemberSettingsMock).toHaveBeenCalledWith({
        workspaceMemberId: 'workspace-member-1',
        update: { isEmailSignatureIncludedByDefault: true },
      }),
    );
  });

  it('should not let the user turn the default on without a signature', () => {
    setCurrentWorkspaceMember({
      emailSignature: '',
      isEmailSignatureIncludedByDefault: false,
    });

    renderSection();

    expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
  });

  it('should persist the signature the user types', async () => {
    jest.useFakeTimers({ advanceTimers: true });

    setCurrentWorkspaceMember({
      emailSignature: '',
      isEmailSignatureIncludedByDefault: false,
    });

    renderSection();

    await userEvent.type(
      screen.getByLabelText('Email signature editor'),
      'Ada',
    );

    jest.advanceTimersByTime(600);

    await waitFor(() =>
      expect(updateWorkspaceMemberSettingsMock).toHaveBeenCalledWith({
        workspaceMemberId: 'workspace-member-1',
        update: { emailSignature: 'Ada' },
      }),
    );

    jest.useRealTimers();
  });
});
