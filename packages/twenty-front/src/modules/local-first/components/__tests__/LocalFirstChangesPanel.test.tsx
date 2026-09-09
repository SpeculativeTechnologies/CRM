import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LocalFirstChangesPanel } from '@/local-first/components/LocalFirstChangesPanel';

jest.mock('@/local-first/services/getCurrentLocalFirstScope', () => ({
  getCurrentLocalFirstScope: () => null,
}));
jest.mock('@/local-first/services/getLocalFirstDatabase', () => ({}));
jest.mock('@/local-first/services/startLocalFirstJournalSync', () => ({
  startLocalFirstJournalSync: () => () => {},
}));

it('should retain a visible save failure until dismissed, without a snackbar provider', async () => {
  render(
    <I18nProvider i18n={i18n}>
      <LocalFirstChangesPanel />
    </I18nProvider>,
  );
  act(() => {
    window.dispatchEvent(new Event('twenty-local-save-failed'));
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'This edit could not be saved on this device.',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
