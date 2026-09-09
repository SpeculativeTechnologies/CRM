// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mutation, close, snackbar, selection } = vi.hoisted(() => ({
  mutation: vi.fn(),
  close: vi.fn(),
  snackbar: vi.fn(),
  selection: { ids: ['person-1'] },
}));
vi.mock('twenty-client-sdk/core', () => ({
  CoreApiClient: vi.fn(function () {
    return { mutation };
  }),
}));
vi.mock('twenty-sdk/front-component', () => ({
  useSelectedRecordIds: () => selection.ids,
  closeSidePanel: close,
  unmountFrontComponent: vi.fn(),
  enqueueSnackbar: snackbar,
}));

import { LogContact } from 'src/components/log-contact';

beforeEach(() => {
  vi.clearAllMocks();
  selection.ids = ['person-1'];
  mutation.mockResolvedValue({ createContactLog: { id: 'log-1' } });
});
afterEach(cleanup);

const fillContactDate = () =>
  fireEvent.change(screen.getByLabelText('Contact date'), {
    target: { value: '2025-06-01T14:30' },
  });

describe('Log contact form', () => {
  it('should stay on the person tab and allow another contact after saving', async () => {
    const user = userEvent.setup();
    render(createElement(LogContact, { presentation: 'tab' }));
    fillContactDate();
    await user.type(
      screen.getByLabelText('Notes (optional)'),
      'First conversation',
    );
    await user.click(screen.getByRole('button', { name: 'Save contact' }));
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1));
    expect(close).not.toHaveBeenCalled();
    expect(
      (screen.getByLabelText('Notes (optional)') as HTMLTextAreaElement).value,
    ).toBe('');
    fillContactDate();
    await user.click(screen.getByRole('button', { name: 'Save contact' }));
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(2));
    expect(close).not.toHaveBeenCalled();
  });

  it('should clear the tab form without navigating or saving', async () => {
    const user = userEvent.setup();
    render(createElement(LogContact, { presentation: 'tab' }));
    await user.type(
      screen.getByLabelText('Notes (optional)'),
      'Unfinished notes',
    );
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(
      (screen.getByLabelText('Notes (optional)') as HTMLTextAreaElement).value,
    ).toBe('');
    expect(close).not.toHaveBeenCalled();
    expect(mutation).not.toHaveBeenCalled();
  });

  it('should save a dated text message on the selected person with notes and direction', async () => {
    const user = userEvent.setup();
    render(createElement(LogContact));
    await user.selectOptions(screen.getByLabelText('Channel'), 'TEXT');
    await user.selectOptions(screen.getByLabelText('Direction'), 'INBOUND');
    fillContactDate();
    await user.type(
      screen.getByLabelText('Notes (optional)'),
      'They replied about the brief.',
    );
    await user.click(screen.getByRole('button', { name: 'Save contact' }));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(mutation).toHaveBeenCalledExactlyOnceWith({
      createContactLog: {
        __args: {
          data: {
            personId: 'person-1',
            channel: 'TEXT',
            direction: 'INBOUND',
            name: 'Text message',
            occurredAt: new Date('2025-06-01T14:30').toISOString(),
            notes: 'They replied about the brief.',
          },
        },
        id: true,
      },
    });
    expect(snackbar).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('should retain the form contents when saving fails and allow a retry', async () => {
    const user = userEvent.setup();
    mutation.mockRejectedValueOnce(
      new Error('You do not have permission to create contact logs.'),
    );
    render(createElement(LogContact));
    fillContactDate();
    await user.type(
      screen.getByLabelText('Notes (optional)'),
      'Keep these notes',
    );
    await user.click(screen.getByRole('button', { name: 'Save contact' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'permission',
    );
    expect(
      (screen.getByLabelText('Notes (optional)') as HTMLTextAreaElement).value,
    ).toBe('Keep these notes');
    expect(close).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save contact' }));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(mutation).toHaveBeenCalledTimes(2);
  });

  it('should reject a future date without saving', async () => {
    const user = userEvent.setup();
    render(createElement(LogContact));
    fireEvent.change(screen.getByLabelText('Contact date'), {
      target: { value: '2099-06-01T14:30' },
    });
    await user.click(screen.getByRole('button', { name: 'Save contact' }));
    expect((await screen.findByRole('alert')).textContent).toContain('past');
    expect(mutation).not.toHaveBeenCalled();
  });

  it('should disable saving when multiple people are selected', () => {
    selection.ids = ['person-1', 'person-2'];
    render(createElement(LogContact));
    expect(
      (
        screen.getByRole('button', {
          name: 'Save contact',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain(
      'Select one person',
    );
  });

  it('should close without saving when canceled', async () => {
    const user = userEvent.setup();
    render(createElement(LogContact));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(mutation).not.toHaveBeenCalled();
  });
});
