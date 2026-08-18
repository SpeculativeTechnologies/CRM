import { useTextInputFocusStack } from '@/ui/input/hooks/useTextInputFocusStack';
import { useGlobalHotkeys } from '@/ui/utilities/hotkey/hooks/useGlobalHotkeys';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore, Provider as JotaiProvider } from 'jotai';

const GlobalHotkeyEffect = ({ callback }: { callback: () => void }) => {
  useGlobalHotkeys({
    keys: ['/'],
    callback,
    containsModifier: false,
    dependencies: [callback],
    options: {
      ignoreModifiers: true,
    },
  });

  return null;
};

const ProtectedInput = () => {
  const { handleFocus, handleBlur } = useTextInputFocusStack({
    focusId: 'test-text-input',
  });

  return (
    <input
      aria-label="protected"
      onFocus={handleFocus}
      onBlur={handleBlur}
      type="text"
    />
  );
};

const renderWithGlobalHotkey = (input: React.ReactNode) => {
  const callback = jest.fn();

  render(
    <JotaiProvider store={createStore()}>
      <GlobalHotkeyEffect callback={callback} />
      {input}
    </JotaiProvider>,
  );

  return { callback };
};

describe('useTextInputFocusStack', () => {
  it('should let global single key hotkeys fire while typing in an unregistered input', async () => {
    const { callback } = renderWithGlobalHotkey(
      <input aria-label="unprotected" type="text" />,
    );

    await userEvent.type(screen.getByLabelText('unprotected'), '9/12');

    expect(callback).toHaveBeenCalled();
  });

  it('should suppress global single key hotkeys while the input is focused', async () => {
    const { callback } = renderWithGlobalHotkey(<ProtectedInput />);

    const input = screen.getByLabelText('protected');

    await userEvent.type(input, '9/12');

    expect(callback).not.toHaveBeenCalled();
    expect(input).toHaveValue('9/12');
  });

  it('should restore global single key hotkeys once the input is blurred', async () => {
    const { callback } = renderWithGlobalHotkey(
      <>
        <ProtectedInput />
        <button>outside</button>
      </>,
    );

    await userEvent.click(screen.getByLabelText('protected'));
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    await userEvent.keyboard('/');

    expect(callback).toHaveBeenCalled();
  });
});
