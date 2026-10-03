import { AppNavigationDrawer } from '@/navigation/components/AppNavigationDrawer';
import { useIsSettingsDrawer } from '@/navigation/hooks/useIsSettingsDrawer';
import { useIsMobile } from 'twenty-ui/utilities';
import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';

jest.mock('@/navigation/hooks/useIsSettingsDrawer');
jest.mock('twenty-ui/utilities', () => ({
  ...jest.requireActual('twenty-ui/utilities'),
  useIsMobile: jest.fn(),
}));

jest.mock('@/navigation/components/MainNavigationDrawerContent', () => ({
  MainNavigationDrawerContent: () => <div>Main content</div>,
}));

jest.mock(
  '@/navigation/components/MainNavigationDrawerFeatureRequestItem',
  () => ({
    MainNavigationDrawerFeatureRequestItem: () => (
      <a href="https://github.com/SpeculativeTechnologies/CRM/issues/new">
        Request a feature
      </a>
    ),
  }),
);

jest.mock('@/navigation/components/MainNavigationDrawerModeSwitcher', () => ({
  MainNavigationDrawerModeSwitcher: () => (
    <button type="button">Navigation modes</button>
  ),
}));

jest.mock('@/navigation/components/SettingsNavigationDrawerContent', () => ({
  SettingsNavigationDrawerContent: () => <div>Settings content</div>,
}));

jest.mock('@/navigation/components/NavigationDrawerModeTransition', () => ({
  NavigationDrawerModeTransition: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock(
  '@/ui/navigation/navigation-drawer/components/NavigationDrawer',
  () => ({
    NavigationDrawer: ({ children }: { children: ReactNode }) => (
      <aside>{children}</aside>
    ),
  }),
);

jest.mock(
  '@/ui/navigation/navigation-drawer/components/NavigationDrawerFixedContent',
  () => ({
    NavigationDrawerFixedContent: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  }),
);

describe('AppNavigationDrawer', () => {
  beforeEach(() => {
    jest.mocked(useIsMobile).mockReturnValue(false);
    jest.mocked(useIsSettingsDrawer).mockReturnValue(false);
  });

  it('keeps the feature request link in the main navigation after the drawer refactor', () => {
    const { rerender } = render(<AppNavigationDrawer />);
    expect(
      screen.getByRole('link', { name: 'Request a feature' }),
    ).toBeInTheDocument();
    jest.mocked(useIsSettingsDrawer).mockReturnValue(true);
    rerender(<AppNavigationDrawer />);
    expect(
      screen.queryByRole('link', { name: 'Request a feature' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the mode switcher mounted when the drawer content changes', () => {
    const { rerender } = render(<AppNavigationDrawer />);
    const modeSwitcher = screen.getByRole('button', {
      name: 'Navigation modes',
    });

    expect(screen.getByText('Main content')).toBeInTheDocument();

    jest.mocked(useIsSettingsDrawer).mockReturnValue(true);
    rerender(<AppNavigationDrawer />);

    expect(screen.getByText('Settings content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Navigation modes' })).toBe(
      modeSwitcher,
    );
  });

  it('leaves mode switching to the navigation bar on mobile', () => {
    jest.mocked(useIsMobile).mockReturnValue(true);
    jest.mocked(useIsSettingsDrawer).mockReturnValue(true);

    render(<AppNavigationDrawer />);

    expect(screen.getByText('Settings content')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Navigation modes' }),
    ).not.toBeInTheDocument();
  });
});
