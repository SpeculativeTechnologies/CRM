import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PersonalWorkspaceOfflineStatus } from '@/local-first/components/PersonalWorkspaceOfflineStatus';
import {
  isPersonalWorkspaceReadyOffline,
  preparePersonalWorkspaceOffline,
  removePersonalWorkspaceOffline,
} from '@/local-first/services/preparePersonalWorkspaceOffline';

jest.mock('@/local-first/services/preparePersonalWorkspaceOffline', () => ({
  isPersonalWorkspaceReadyOffline: jest.fn(),
  preparePersonalWorkspaceOffline: jest.fn(),
  removePersonalWorkspaceOffline: jest.fn(),
}));

const renderStatus = (isBuilt = true) =>
  render(
    <I18nProvider i18n={i18n}>
      <PersonalWorkspaceOfflineStatus isBuilt={isBuilt} />
    </I18nProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.removeItem('twenty-personal-offline-disabled');
  jest.mocked(isPersonalWorkspaceReadyOffline).mockResolvedValue(false);
  jest.mocked(preparePersonalWorkspaceOffline).mockResolvedValue(undefined);
  jest.mocked(removePersonalWorkspaceOffline).mockResolvedValue(undefined);
});

it('should prepare offline access on opening without a button click', async () => {
  renderStatus();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Preparing offline access automatically',
  );
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Personal workspace ready for offline reopening',
    ),
  );
  expect(preparePersonalWorkspaceOffline).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole('button', { name: 'Prepare offline copy' }),
  ).not.toBeInTheDocument();
});

it('should use an existing offline copy without requiring a server connection', async () => {
  jest.mocked(isPersonalWorkspaceReadyOffline).mockResolvedValue(true);
  renderStatus();
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Personal workspace ready for offline reopening',
    ),
  );
  expect(preparePersonalWorkspaceOffline).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('should retry preparation when the connection returns after a failure', async () => {
  jest
    .mocked(preparePersonalWorkspaceOffline)
    .mockRejectedValueOnce(new Error('Offline'));
  renderStatus();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Your tools are still saved on this device.',
  );
  act(() => window.dispatchEvent(new Event('online')));
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Personal workspace ready for offline reopening',
    ),
  );
  expect(preparePersonalWorkspaceOffline).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('should allow retrying a failed preparation explicitly', async () => {
  jest
    .mocked(preparePersonalWorkspaceOffline)
    .mockRejectedValueOnce(new Error('Unavailable'));
  renderStatus();
  await userEvent.click(
    await screen.findByRole('button', { name: 'Retry offline preparation' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Personal workspace ready for offline reopening',
    ),
  );
  expect(preparePersonalWorkspaceOffline).toHaveBeenCalledTimes(2);
});

it('should remember removal across visits until offline access is enabled again', async () => {
  const firstVisit = renderStatus();
  await userEvent.click(
    await screen.findByRole('button', { name: 'Remove offline copy' }),
  );
  await waitFor(() =>
    expect(removePersonalWorkspaceOffline).toHaveBeenCalled(),
  );
  firstVisit.unmount();
  jest.mocked(preparePersonalWorkspaceOffline).mockClear();
  renderStatus();
  act(() => window.dispatchEvent(new Event('online')));
  expect(screen.getByRole('status')).toHaveTextContent(
    'Automatic offline access is turned off.',
  );
  expect(preparePersonalWorkspaceOffline).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole('button', { name: 'Enable offline access' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Personal workspace ready for offline reopening',
    ),
  );
  expect(preparePersonalWorkspaceOffline).toHaveBeenCalledTimes(1);
});

it('should explain a failed removal and allow retrying it', async () => {
  jest
    .mocked(removePersonalWorkspaceOffline)
    .mockRejectedValueOnce(new Error('Storage unavailable'));
  renderStatus();
  await userEvent.click(
    await screen.findByRole('button', { name: 'Remove offline copy' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The offline copy could not be removed.',
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Remove offline copy' }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
  );
  expect(removePersonalWorkspaceOffline).toHaveBeenCalledTimes(2);
});

it('should keep offline installation disabled in the source development server', () => {
  renderStatus(false);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Offline startup is tested in the built preview.',
  );
  expect(preparePersonalWorkspaceOffline).not.toHaveBeenCalled();
});
