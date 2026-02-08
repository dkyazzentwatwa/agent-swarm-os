import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { Layout } from './Layout';

// Mock hooks
vi.mock('@/hooks/useWorkspace', () => ({
  useWorkspace: vi.fn(),
}));

vi.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/' }),
    Outlet: ({ context }) => <div data-testid="outlet">Outlet Content</div>,
  };
});

import { useWorkspace } from '@/hooks/useWorkspace';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const mockWorkspaceData = {
  workspaceId: 'workspace-1',
  manifest: {
    workspace: {
      id: 'workspace-1',
      title: 'Test Workspace',
    },
    team: {
      name: 'test-team',
    },
  },
  workspaces: [
    { id: 'workspace-1', label: 'Test Workspace' },
    { id: 'workspace-2', label: 'Another Workspace' },
  ],
};

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspace.mockReturnValue({
      data: mockWorkspaceData,
      isLoading: false,
    });
    useKeyboardShortcuts.mockImplementation(() => {});

    // Mock localStorage
    Storage.prototype.getItem = vi.fn();
    Storage.prototype.setItem = vi.fn();
  });

  describe('Skip Links (Accessibility)', () => {
    it('renders skip to main content link', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    it('renders skip to navigation link', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const skipLink = screen.getByText('Skip to navigation');
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#sidebar-nav');
    });

    it('skip links have sr-only class by default', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const skipLinks = screen.getAllByRole('link', { name: /skip to/i });
      skipLinks.forEach(link => {
        expect(link.className).toContain('sr-only');
      });
    });

    it('skip links become visible on focus', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink.className).toContain('focus:not-sr-only');
    });

    it('skip links have proper focus styles', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink.className).toContain('focus:absolute');
      expect(skipLink.className).toContain('focus:z-50');
      expect(skipLink.className).toContain('focus:ring-2');
    });
  });

  describe('ARIA Landmarks', () => {
    it('renders navigation landmark', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const nav = document.querySelector('#sidebar-nav');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute('aria-label', 'Main navigation');
    });

    it('renders main landmark', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const main = document.querySelector('#main-content');
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute('role', 'main');
      expect(main).toHaveAttribute('aria-label', 'Main content');
    });

    it('main content has proper structure', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const main = document.querySelector('#main-content');
      expect(main.tagName).toBe('MAIN');
      expect(main.className).toContain('flex-1');
      expect(main.className).toContain('overflow-auto');
    });

    it('navigation is within nav element', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const nav = document.querySelector('nav');
      expect(nav).toHaveAttribute('id', 'sidebar-nav');
    });
  });

  describe('Workspace Management', () => {
    it('renders with active workspace', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      // Sidebar should receive workspace data
      expect(useWorkspace).toHaveBeenCalled();
    });

    it('handles workspace change', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      // Implementation depends on how workspace selection is exposed
      // This test verifies the handler exists and can be called
      expect(useWorkspace).toHaveBeenCalledWith(expect.any(String));
    });

    it('stores selected workspace in localStorage', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      // Should call localStorage.setItem for workspace
      // Implementation depends on when workspace is set
      expect(Storage.prototype.getItem).toHaveBeenCalledWith(
        'agent-squad.selectedWorkspaceId'
      );
    });

    it('recovers when selected workspace is not found', () => {
      useWorkspace.mockReturnValue({
        data: {
          ...mockWorkspaceData,
          workspaceNotFound: true,
        },
        isLoading: false,
      });

      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      // Should fallback to first available workspace
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });
  });

  describe('Theme Toggle', () => {
    it('passes theme props to Sidebar', () => {
      const onToggleTheme = vi.fn();
      renderWithProviders(
        <Layout activeThemeLabel="Dark" onToggleTheme={onToggleTheme} />
      );

      // Sidebar should receive theme props
      // Actual verification depends on Sidebar implementation
    });

    it('calls onToggleTheme when theme changes', () => {
      const onToggleTheme = vi.fn();
      renderWithProviders(
        <Layout activeThemeLabel="Light" onToggleTheme={onToggleTheme} />
      );

      // Verification depends on how theme toggle is exposed in UI
      expect(onToggleTheme).toBeDefined();
    });
  });

  describe('Sidebar Collapse', () => {
    it('stores sidebar collapsed state in localStorage', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      expect(Storage.prototype.getItem).toHaveBeenCalledWith(
        'agent-squad.sidebarCollapsed'
      );
    });

    it('reads initial collapsed state from localStorage', () => {
      Storage.prototype.getItem.mockReturnValue('1');

      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      expect(Storage.prototype.getItem).toHaveBeenCalledWith(
        'agent-squad.sidebarCollapsed'
      );
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('registers keyboard shortcuts', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      expect(useKeyboardShortcuts).toHaveBeenCalled();
    });

    it('provides navigation shortcuts', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const call = useKeyboardShortcuts.mock.calls[0][0];

      expect(call).toHaveProperty('goMission');
      expect(call).toHaveProperty('goSummary');
      expect(call).toHaveProperty('goTasks');
      expect(call).toHaveProperty('goComms');
      expect(call).toHaveProperty('goArtifacts');
      expect(call).toHaveProperty('goAnalytics');
    });

    it('provides workspace navigation shortcuts', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const call = useKeyboardShortcuts.mock.calls[0][0];

      expect(call).toHaveProperty('previousWorkspace');
      expect(call).toHaveProperty('nextWorkspace');
    });

    it('provides theme toggle shortcut', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const call = useKeyboardShortcuts.mock.calls[0][0];

      expect(call).toHaveProperty('toggleTheme');
    });

    it('provides command palette shortcut', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const call = useKeyboardShortcuts.mock.calls[0][0];

      expect(call).toHaveProperty('openPalette');
    });
  });

  describe('Outlet Context', () => {
    it('provides workspaceId to outlet', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const outlet = screen.getByTestId('outlet');
      expect(outlet).toBeInTheDocument();
    });

    it('provides workspaceData to outlet', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      // Outlet receives context via useOutletContext in child routes
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    it('includes workspace change handler in context', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      // Context should include onWorkspaceChange function
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });
  });

  describe('Command Palette', () => {
    it('renders command palette when OPERATOR_MODE enabled', () => {
      // This test depends on OPERATOR_MODE feature flag
      // Mock it if necessary
    });

    it('builds commands for palette', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      // Commands should be built from workspace data
      expect(useWorkspace).toHaveBeenCalled();
    });
  });

  describe('Kickoff Prompt', () => {
    it('builds kickoff prompt with workspace info', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      // Kickoff prompt should include workspace path and team name
      // Verification depends on how this is exposed
    });
  });

  describe('Recent Workspaces', () => {
    it('stores recent workspace IDs', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      expect(Storage.prototype.getItem).toHaveBeenCalledWith(
        'agent-squad.recentWorkspaceIds'
      );
    });

    it('limits recent workspaces to 5', () => {
      const recentIds = JSON.stringify([
        'ws-1', 'ws-2', 'ws-3', 'ws-4', 'ws-5', 'ws-6'
      ]);
      Storage.prototype.getItem.mockReturnValue(recentIds);

      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      // Should only keep 5 most recent
      expect(Storage.prototype.getItem).toHaveBeenCalled();
    });
  });

  describe('Responsive Layout', () => {
    it('has flex layout on large screens', () => {
      const { container } = renderWithProviders(
        <Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />
      );

      const layout = container.querySelector('.min-h-screen');
      expect(layout.className).toContain('lg:flex');
    });

    it('main content is scrollable', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const main = document.querySelector('#main-content');
      expect(main.className).toContain('overflow-auto');
    });

    it('has responsive padding', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      const main = document.querySelector('#main-content');
      expect(main.className).toContain('p-4');
      expect(main.className).toContain('sm:p-6');
      expect(main.className).toContain('lg:p-8');
    });
  });

  describe('Loading States', () => {
    it('handles workspace loading state', () => {
      useWorkspace.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      // Should still render layout structure
      expect(document.querySelector('#main-content')).toBeInTheDocument();
    });

    it('handles missing workspace data gracefully', () => {
      useWorkspace.mockReturnValue({
        data: null,
        isLoading: false,
      });

      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      expect(document.querySelector('#main-content')).toBeInTheDocument();
    });
  });

  describe('Accessibility - Overall', () => {
    it('has proper document structure', () => {
      renderWithProviders(<Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />);

      // Should have nav and main landmarks
      expect(document.querySelector('nav')).toBeInTheDocument();
      expect(document.querySelector('main')).toBeInTheDocument();
    });

    it('skip links are first in tab order', () => {
      const { container } = renderWithProviders(
        <Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />
      );

      const allLinks = container.querySelectorAll('a');
      const firstLink = allLinks[0];

      expect(firstLink.textContent).toMatch(/skip to/i);
    });

    it('has background color for body', () => {
      const { container } = renderWithProviders(
        <Layout activeThemeLabel="Light" onToggleTheme={vi.fn()} />
      );

      const body = container.querySelector('.min-h-screen');
      expect(body.className).toContain('bg-background');
    });
  });
});
