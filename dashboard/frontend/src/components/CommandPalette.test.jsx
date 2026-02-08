import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from './CommandPalette';

// Mock Modal component
vi.mock('./Modal', () => ({
  Modal: ({ isOpen, onClose, title, subtitle, children }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="modal">
        <h2>{title}</h2>
        <p>{subtitle}</p>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    );
  },
}));

describe('CommandPalette', () => {
  const mockCommands = [
    {
      id: 'goto-tasks',
      label: 'Go to Tasks',
      group: 'Navigation',
      shortcut: 'Ctrl+T',
      keywords: ['tasks', 'todo'],
    },
    {
      id: 'goto-analytics',
      label: 'Go to Analytics',
      group: 'Navigation',
      shortcut: 'Ctrl+A',
      keywords: ['analytics', 'stats'],
    },
    {
      id: 'toggle-theme',
      label: 'Toggle Theme',
      group: 'Settings',
      shortcut: 'Ctrl+Shift+T',
      keywords: ['dark', 'light', 'theme'],
    },
    {
      id: 'disabled-command',
      label: 'Disabled Command',
      group: 'Disabled',
      disabled: true,
    },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    commands: mockCommands,
    onRun: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Integration', () => {
    it('renders inside Modal component', () => {
      render(<CommandPalette {...defaultProps} />);
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('shows modal title and subtitle', () => {
      render(<CommandPalette {...defaultProps} />);
      expect(screen.getByText('Command Palette')).toBeInTheDocument();
      expect(screen.getByText('Jump anywhere and run actions')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<CommandPalette {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('calls onClose when modal is closed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<CommandPalette {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Search Input', () => {
    it('renders search input', () => {
      render(<CommandPalette {...defaultProps} />);
      expect(screen.getByPlaceholderText('Search commands...')).toBeInTheDocument();
    });

    it('has proper ARIA attributes', () => {
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');
      expect(input).toHaveAttribute('aria-label', 'Search commands');
      expect(input).toHaveAttribute('aria-describedby', 'command-palette-help');
      expect(input).toHaveAttribute('aria-controls', 'command-palette-list');
    });

    it('focuses input when palette opens', async () => {
      render(<CommandPalette {...defaultProps} />);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Search commands...');
        expect(document.activeElement).toBe(input);
      });
    });

    it('updates query on input', async () => {
      const user = userEvent.setup();
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await user.type(input, 'tasks');

      expect(input).toHaveValue('tasks');
    });
  });

  describe('Command List', () => {
    it('renders command list with proper ARIA', () => {
      render(<CommandPalette {...defaultProps} />);

      const listbox = screen.getByRole('listbox', { name: 'Commands' });
      expect(listbox).toBeInTheDocument();
      expect(listbox).toHaveAttribute('id', 'command-palette-list');
    });

    it('displays all commands initially', () => {
      render(<CommandPalette {...defaultProps} />);

      expect(screen.getByText('Go to Tasks')).toBeInTheDocument();
      expect(screen.getByText('Go to Analytics')).toBeInTheDocument();
      expect(screen.getByText('Toggle Theme')).toBeInTheDocument();
      expect(screen.getByText('Disabled Command')).toBeInTheDocument();
    });

    it('renders commands as options with proper role', () => {
      render(<CommandPalette {...defaultProps} />);

      const options = screen.getAllByRole('option');
      expect(options.length).toBe(4);
    });

    it('displays command groups', () => {
      render(<CommandPalette {...defaultProps} />);

      expect(screen.getByText('Navigation')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });

    it('displays keyboard shortcuts', () => {
      render(<CommandPalette {...defaultProps} />);

      expect(screen.getByText('Ctrl+T')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+A')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+Shift+T')).toBeInTheDocument();
    });

    it('first command is active by default', () => {
      render(<CommandPalette {...defaultProps} />);

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Search Filtering', () => {
    it('filters commands by label', async () => {
      const user = userEvent.setup();
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await user.type(input, 'analytics');

      expect(screen.getByText('Go to Analytics')).toBeInTheDocument();
      expect(screen.queryByText('Go to Tasks')).not.toBeInTheDocument();
      expect(screen.queryByText('Toggle Theme')).not.toBeInTheDocument();
    });

    it('filters commands by group', async () => {
      const user = userEvent.setup();
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await user.type(input, 'navigation');

      expect(screen.getByText('Go to Tasks')).toBeInTheDocument();
      expect(screen.getByText('Go to Analytics')).toBeInTheDocument();
      expect(screen.queryByText('Toggle Theme')).not.toBeInTheDocument();
    });

    it('filters commands by keywords', async () => {
      const user = userEvent.setup();
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await user.type(input, 'dark');

      // Should match "Toggle Theme" which has "dark" keyword
      expect(screen.getByText('Toggle Theme')).toBeInTheDocument();
      expect(screen.queryByText('Go to Tasks')).not.toBeInTheDocument();
    });

    it('shows empty state when no matches', async () => {
      const user = userEvent.setup();
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await user.type(input, 'nonexistent command xyz');

      expect(screen.getByText('No commands found.')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('No commands found.');
    });

    it('is case insensitive', async () => {
      const user = userEvent.setup();
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await user.type(input, 'TASKS');

      expect(screen.getByText('Go to Tasks')).toBeInTheDocument();
    });

    it('prioritizes exact prefix matches', async () => {
      const user = userEvent.setup();
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await user.type(input, 'go');

      const options = screen.getAllByRole('option');
      // "Go to Tasks" and "Go to Analytics" should be first (exact prefix match)
      expect(options[0]).toHaveTextContent('Go to');
    });

    it('resets active index when filtering', async () => {
      const user = userEvent.setup();
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');

      // Navigate down
      await user.keyboard('{ArrowDown}');

      // Filter
      await user.type(input, 'analytics');

      // First (and only) result should be active
      const option = screen.getByRole('option');
      expect(option).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Keyboard Navigation', () => {
    it('navigates down with ArrowDown', async () => {
      const user = userEvent.setup();
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await user.type(input, '{ArrowDown}');

      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('navigates up with ArrowUp', async () => {
      const user = userEvent.setup();
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');

      // Go down twice
      await user.keyboard('{ArrowDown}{ArrowDown}');

      // Go up once
      await user.keyboard('{ArrowUp}');

      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('wraps to bottom when navigating up from first', async () => {
      const user = userEvent.setup();
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await user.type(input, '{ArrowUp}');

      const options = screen.getAllByRole('option');
      // Should wrap to last item
      expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true');
    });

    it('wraps to top when navigating down from last', async () => {
      const user = userEvent.setup();
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');

      // Navigate to last item
      const options = screen.getAllByRole('option');
      for (let i = 0; i < options.length; i++) {
        await user.keyboard('{ArrowDown}');
      }

      // Should wrap back to first
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('runs active command with Enter', async () => {
      const user = userEvent.setup();
      const onRun = vi.fn();
      const onClose = vi.fn();

      render(<CommandPalette {...defaultProps} onRun={onRun} onClose={onClose} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await user.type(input, '{Enter}');

      expect(onRun).toHaveBeenCalledWith(mockCommands[0]);
      expect(onClose).toHaveBeenCalled();
    });

    it('does not run disabled commands', async () => {
      const user = userEvent.setup();
      const onRun = vi.fn();

      render(<CommandPalette {...defaultProps} onRun={onRun} />);

      const input = screen.getByPlaceholderText('Search commands...');

      // Navigate to disabled command
      await user.type(input, 'disabled');
      await user.keyboard('{Enter}');

      expect(onRun).not.toHaveBeenCalled();
    });
  });

  describe('Mouse Interaction', () => {
    it('runs command when clicked', async () => {
      const user = userEvent.setup();
      const onRun = vi.fn();
      const onClose = vi.fn();

      render(<CommandPalette {...defaultProps} onRun={onRun} onClose={onClose} />);

      const option = screen.getByText('Go to Tasks');
      await user.click(option);

      expect(onRun).toHaveBeenCalledWith(mockCommands[0]);
      expect(onClose).toHaveBeenCalled();
    });

    it('does not run disabled command when clicked', async () => {
      const user = userEvent.setup();
      const onRun = vi.fn();

      render(<CommandPalette {...defaultProps} onRun={onRun} />);

      const option = screen.getByText('Disabled Command');
      await user.click(option);

      expect(onRun).not.toHaveBeenCalled();
    });

    it('has hover state for non-active commands', () => {
      const { container } = render(<CommandPalette {...defaultProps} />);

      const options = container.querySelectorAll('[role="option"]');
      const nonActiveOption = options[1]; // Second option (not active)

      expect(nonActiveOption.className).toContain('hover:bg-[var(--interactive-hover)]');
    });

    it('has active state for active command', () => {
      const { container } = render(<CommandPalette {...defaultProps} />);

      const options = container.querySelectorAll('[role="option"]');
      const activeOption = options[0]; // First option (active by default)

      expect(activeOption.className).toContain('bg-[var(--interactive-active)]');
    });
  });

  describe('Disabled Commands', () => {
    it('marks disabled commands visually', () => {
      const { container } = render(<CommandPalette {...defaultProps} />);

      const disabledOption = screen.getByText('Disabled Command').closest('button');
      expect(disabledOption).toHaveAttribute('disabled');
      expect(disabledOption.className).toContain('opacity-50');
    });

    it('disabled commands appear in search results', async () => {
      const user = userEvent.setup();
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await user.type(input, 'disabled');

      expect(screen.getByText('Disabled Command')).toBeInTheDocument();
    });
  });

  describe('Help Text', () => {
    it('displays help text', () => {
      render(<CommandPalette {...defaultProps} />);

      expect(screen.getByText('Use ↑/↓ to navigate, Enter to run, Esc to close.')).toBeInTheDocument();
    });

    it('help text has proper id for aria-describedby', () => {
      render(<CommandPalette {...defaultProps} />);

      const helpText = screen.getByText('Use ↑/↓ to navigate, Enter to run, Esc to close.');
      expect(helpText).toHaveAttribute('id', 'command-palette-help');
    });
  });

  describe('Accessibility (ARIA)', () => {
    it('search input controls listbox', () => {
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');
      expect(input).toHaveAttribute('aria-controls', 'command-palette-list');

      const listbox = document.getElementById('command-palette-list');
      expect(listbox).toBeInTheDocument();
    });

    it('search input described by help text', () => {
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');
      expect(input).toHaveAttribute('aria-describedby', 'command-palette-help');

      const helpText = document.getElementById('command-palette-help');
      expect(helpText).toBeInTheDocument();
    });

    it('listbox has accessible name', () => {
      render(<CommandPalette {...defaultProps} />);

      const listbox = screen.getByRole('listbox', { name: 'Commands' });
      expect(listbox).toHaveAttribute('aria-label', 'Commands');
    });

    it('options have aria-selected attribute', () => {
      render(<CommandPalette {...defaultProps} />);

      const options = screen.getAllByRole('option');
      options.forEach((option, index) => {
        if (index === 0) {
          expect(option).toHaveAttribute('aria-selected', 'true');
        } else {
          expect(option).toHaveAttribute('aria-selected', 'false');
        }
      });
    });

    it('empty state has role status', () => {
      render(<CommandPalette {...defaultProps} commands={[]} />);

      const emptyState = screen.getByText('No commands found.');
      expect(emptyState).toHaveAttribute('role', 'status');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty commands array', () => {
      render(<CommandPalette {...defaultProps} commands={[]} />);

      expect(screen.getByText('No commands found.')).toBeInTheDocument();
    });

    it('handles commands without shortcuts', () => {
      const commandsWithoutShortcuts = [
        { id: 'cmd-1', label: 'Command 1', group: 'Group 1' },
      ];

      render(<CommandPalette {...defaultProps} commands={commandsWithoutShortcuts} />);

      expect(screen.getByText('Command 1')).toBeInTheDocument();
      // Should not crash, shortcuts are optional
    });

    it('handles commands without keywords', () => {
      const commandsWithoutKeywords = [
        { id: 'cmd-1', label: 'Command 1', group: 'Group 1' },
      ];

      render(<CommandPalette {...defaultProps} commands={commandsWithoutKeywords} />);

      expect(screen.getByText('Command 1')).toBeInTheDocument();
    });

    it('handles undefined onRun callback', async () => {
      const user = userEvent.setup();

      render(<CommandPalette {...defaultProps} onRun={undefined} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await expect(user.type(input, '{Enter}')).resolves.not.toThrow();
    });

    it('handles undefined onClose callback', async () => {
      const user = userEvent.setup();

      render(<CommandPalette {...defaultProps} onClose={undefined} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await expect(user.type(input, '{Enter}')).resolves.not.toThrow();
    });
  });

  describe('Fuzzy Search Scoring', () => {
    it('scores exact prefix matches highest', async () => {
      const user = userEvent.setup();
      const commands = [
        { id: '1', label: 'Go to Tasks', group: 'Nav' },
        { id: '2', label: 'Toggle Tasks View', group: 'Nav' },
      ];

      render(<CommandPalette {...defaultProps} commands={commands} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await user.type(input, 'go');

      const options = screen.getAllByRole('option');
      // "Go to Tasks" should be first (starts with "go")
      expect(options[0]).toHaveTextContent('Go to Tasks');
    });

    it('scores substring matches lower than prefix', async () => {
      const user = userEvent.setup();
      const commands = [
        { id: '1', label: 'Toggle Theme', group: 'Settings' },
        { id: '2', label: 'Theme Switcher', group: 'Settings' },
      ];

      render(<CommandPalette {...defaultProps} commands={commands} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await user.type(input, 'theme');

      const options = screen.getAllByRole('option');
      // "Theme Switcher" starts with "theme", should be first
      expect(options[0]).toHaveTextContent('Theme Switcher');
    });

    it('excludes commands that do not match', async () => {
      const user = userEvent.setup();
      render(<CommandPalette {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search commands...');
      await user.type(input, 'xyz');

      expect(screen.getByText('No commands found.')).toBeInTheDocument();
    });
  });

  describe('Visual States', () => {
    it('truncates long command labels', () => {
      const commands = [
        {
          id: '1',
          label: 'This is a very long command label that should be truncated to prevent overflow',
          group: 'Test',
        },
      ];

      const { container } = render(<CommandPalette {...defaultProps} commands={commands} />);

      const label = container.querySelector('.truncate');
      expect(label).toBeInTheDocument();
    });

    it('has scrollable command list', () => {
      const { container } = render(<CommandPalette {...defaultProps} />);

      const listbox = container.querySelector('[role="listbox"]');
      expect(listbox.className).toContain('overflow-y-auto');
      expect(listbox.className).toContain('max-h-[50vh]');
    });

    it('removes border from last command', () => {
      const { container } = render(<CommandPalette {...defaultProps} />);

      const options = container.querySelectorAll('[role="option"]');
      const lastOption = options[options.length - 1];

      expect(lastOption.className).toContain('last:border-b-0');
    });
  });
});
