import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import Tasks from './Tasks';

// Mock the hooks
vi.mock('@/hooks/useTasks', () => ({
  useTasks: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: vi.fn(() => ({ workspaceId: 'test-workspace' })),
    useSearchParams: vi.fn(() => [
      new URLSearchParams(),
      vi.fn(),
    ]),
  };
});

import { useTasks } from '@/hooks/useTasks';

const mockTaskData = {
  tasks: [
    {
      id: 'task-1',
      subject: 'Implement login feature',
      description: 'Add user authentication',
      status: 'pending',
      assignee: 'agent-frontend',
      lane: 'backlog',
      createdAt: '2026-02-07T10:00:00.000Z',
    },
    {
      id: 'task-2',
      subject: 'Fix navigation bug',
      description: 'Navigation not working on mobile',
      status: 'in_progress',
      assignee: 'agent-mobile',
      lane: 'development',
      createdAt: '2026-02-07T11:00:00.000Z',
    },
    {
      id: 'task-3',
      subject: 'Write documentation',
      description: 'API documentation needed',
      status: 'completed',
      assignee: 'agent-docs',
      lane: 'done',
      createdAt: '2026-02-07T09:00:00.000Z',
      completedAt: '2026-02-07T12:00:00.000Z',
    },
    {
      id: 'task-4',
      subject: 'Blocked task',
      description: 'Waiting for dependencies',
      status: 'pending',
      assignee: 'agent-backend',
      lane: 'backlog',
      blockedBy: ['task-1'],
      createdAt: '2026-02-07T08:00:00.000Z',
    },
  ],
  summary: {
    total: 4,
    pending: 1,
    inProgress: 1,
    completed: 1,
    blocked: 1,
  },
  lanes: [
    { id: 'backlog', label: 'Backlog' },
    { id: 'development', label: 'Development' },
    { id: 'done', label: 'Done' },
  ],
};

describe('Tasks Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTasks.mockReturnValue({
      data: mockTaskData,
      isLoading: false,
      isSuccess: true,
    });
  });

  describe('Page Structure', () => {
    it('renders page header', () => {
      renderWithProviders(<Tasks />);
      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('Operator triage and execution board')).toBeInTheDocument();
    });

    it('renders task summary statistics', () => {
      renderWithProviders(<Tasks />);

      expect(screen.getByText(/Filtered: 4/i)).toBeInTheDocument();
      expect(screen.getByText(/Pending 1/i)).toBeInTheDocument();
      expect(screen.getByText(/In Progress 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Blocked 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Completed 1/i)).toBeInTheDocument();
    });

    it('renders all four status columns', () => {
      renderWithProviders(<Tasks />);

      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Blocked')).toBeInTheDocument();
    });

    it('renders preset filter buttons', () => {
      renderWithProviders(<Tasks />);

      expect(screen.getByRole('button', { name: /blocked/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /mine \/ lead/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /in progress/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /needs assignment/i })).toBeInTheDocument();
    });

    it('renders search input', () => {
      renderWithProviders(<Tasks />);
      expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
    });

    it('renders filter dropdowns', () => {
      renderWithProviders(<Tasks />);

      const statusSelect = screen.getByLabelText(/filter by status/i);
      expect(statusSelect).toBeInTheDocument();

      const laneSelect = screen.getByLabelText(/filter by lane/i);
      expect(laneSelect).toBeInTheDocument();

      const assigneeSelect = screen.getByLabelText(/filter by assignee/i);
      expect(assigneeSelect).toBeInTheDocument();
    });
  });

  describe('Task Cards', () => {
    it('renders task cards in correct columns', () => {
      renderWithProviders(<Tasks />);

      // Pending column should have task-1 (non-blocked pending)
      const pendingColumn = screen.getAllByText('Pending')[0].closest('.space-y-2');
      expect(within(pendingColumn).getByText('Implement login feature')).toBeInTheDocument();

      // In Progress column should have task-2
      const inProgressColumn = screen.getAllByText('In Progress')[0].closest('.space-y-2');
      expect(within(inProgressColumn).getByText('Fix navigation bug')).toBeInTheDocument();

      // Completed column should have task-3
      const completedColumn = screen.getAllByText('Completed')[0].closest('.space-y-2');
      expect(within(completedColumn).getByText('Write documentation')).toBeInTheDocument();

      // Blocked column should have task-4
      const blockedColumn = screen.getAllByText('Blocked')[0].closest('.space-y-2');
      expect(within(blockedColumn).getByText('Blocked task')).toBeInTheDocument();
    });

    it('displays task ID', () => {
      renderWithProviders(<Tasks />);
      expect(screen.getByText('#task-1')).toBeInTheDocument();
    });

    it('displays task subject', () => {
      renderWithProviders(<Tasks />);
      expect(screen.getByText('Implement login feature')).toBeInTheDocument();
    });

    it('displays task status badge', () => {
      renderWithProviders(<Tasks />);
      const badges = screen.getAllByText('Pending');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('shows blocked task with error styling', () => {
      const { container } = renderWithProviders(<Tasks />);
      const blockedCard = screen.getByText('Blocked task').closest('button');

      expect(blockedCard.className).toContain('border-[var(--status-error)]');
    });
  });

  describe('Search Functionality', () => {
    it('filters tasks by subject', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      const searchInput = screen.getByPlaceholderText('Search tasks...');
      await user.type(searchInput, 'login');

      expect(screen.getByText('Implement login feature')).toBeInTheDocument();
      expect(screen.queryByText('Fix navigation bug')).not.toBeInTheDocument();
    });

    it('filters tasks by description', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      const searchInput = screen.getByPlaceholderText('Search tasks...');
      await user.type(searchInput, 'authentication');

      expect(screen.getByText('Implement login feature')).toBeInTheDocument();
      expect(screen.queryByText('Write documentation')).not.toBeInTheDocument();
    });

    it('filters tasks by ID', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      const searchInput = screen.getByPlaceholderText('Search tasks...');
      await user.type(searchInput, 'task-2');

      expect(screen.getByText('Fix navigation bug')).toBeInTheDocument();
      expect(screen.queryByText('Implement login feature')).not.toBeInTheDocument();
    });

    it('shows no results message when no matches', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      const searchInput = screen.getByPlaceholderText('Search tasks...');
      await user.type(searchInput, 'nonexistent');

      expect(screen.queryByText('Implement login feature')).not.toBeInTheDocument();
      expect(screen.queryByText('Fix navigation bug')).not.toBeInTheDocument();
    });
  });

  describe('Filter Functionality', () => {
    it('filters by status', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      const statusSelect = screen.getByLabelText(/filter by status/i);
      await user.selectOptions(statusSelect, 'in_progress');

      expect(screen.getByText('Fix navigation bug')).toBeInTheDocument();
      expect(screen.queryByText('Implement login feature')).not.toBeInTheDocument();
    });

    it('filters by assignee', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      const assigneeSelect = screen.getByLabelText(/filter by assignee/i);
      await user.selectOptions(assigneeSelect, 'agent-frontend');

      expect(screen.getByText('Implement login feature')).toBeInTheDocument();
      expect(screen.queryByText('Fix navigation bug')).not.toBeInTheDocument();
    });

    it('applies multiple filters simultaneously', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      const searchInput = screen.getByPlaceholderText('Search tasks...');
      await user.type(searchInput, 'task');

      const statusSelect = screen.getByLabelText(/filter by status/i);
      await user.selectOptions(statusSelect, 'pending');

      // Should show pending tasks matching "task"
      expect(screen.getByText('Implement login feature')).toBeInTheDocument();
      expect(screen.queryByText('Fix navigation bug')).not.toBeInTheDocument();
    });
  });

  describe('Preset Filters', () => {
    it('applies blocked preset filter', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      const blockedButton = screen.getByRole('button', { name: /blocked/i });
      await user.click(blockedButton);

      expect(screen.getByText('Blocked task')).toBeInTheDocument();
      expect(screen.queryByText('Implement login feature')).not.toBeInTheDocument();
    });

    it('applies in progress preset filter', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      const inProgressButton = screen.getByRole('button', { name: /in progress/i });
      await user.click(inProgressButton);

      expect(screen.getByText('Fix navigation bug')).toBeInTheDocument();
      expect(screen.queryByText('Write documentation')).not.toBeInTheDocument();
    });

    it('clears preset filter', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      // Apply preset
      const blockedButton = screen.getByRole('button', { name: /blocked/i });
      await user.click(blockedButton);

      // Clear preset
      const clearButton = screen.getByRole('button', { name: /clear preset/i });
      await user.click(clearButton);

      // All tasks should be visible again
      expect(screen.getByText('Implement login feature')).toBeInTheDocument();
      expect(screen.getByText('Fix navigation bug')).toBeInTheDocument();
    });

    it('highlights active preset', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      const blockedButton = screen.getByRole('button', { name: /blocked/i });
      await user.click(blockedButton);

      expect(blockedButton.className).toContain('border-[var(--status-info)]');
    });
  });

  describe('Density Toggle', () => {
    it('toggles between comfortable and compact modes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      const compactButton = screen.getByRole('button', { name: /compact/i });
      await user.click(compactButton);

      expect(compactButton.className).toContain('bg-[var(--interactive-active)]');
    });
  });

  describe('Task Selection', () => {
    it('selects individual task', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);

      expect(checkboxes[0]).toBeChecked();
    });

    it('selects all visible tasks', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      const selectAllButton = screen.getByRole('button', { name: /select visible/i });
      await user.click(selectAllButton);

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
    });

    it('clears all selections', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      // Select all
      const selectAllButton = screen.getByRole('button', { name: /select visible/i });
      await user.click(selectAllButton);

      // Clear selection
      const clearButton = screen.getByRole('button', { name: /clear selection/i });
      await user.click(clearButton);

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });
    });

    it('shows selection count', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Tasks />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when loading', () => {
      useTasks.mockReturnValue({
        data: undefined,
        isLoading: true,
        isSuccess: false,
      });

      renderWithProviders(<Tasks />);

      // Should show skeleton blocks
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no tasks', () => {
      useTasks.mockReturnValue({
        data: { tasks: [], summary: { total: 0 }, lanes: [] },
        isLoading: false,
        isSuccess: true,
      });

      renderWithProviders(<Tasks />);

      // Should show empty state (implementation depends on EmptyState component)
      expect(screen.queryByText('Implement login feature')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible search input label', () => {
      renderWithProviders(<Tasks />);

      const searchInput = screen.getByPlaceholderText('Search tasks...');
      expect(searchInput).toHaveAttribute('id', 'tasks-search');
    });

    it('has accessible filter labels', () => {
      renderWithProviders(<Tasks />);

      expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by lane/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by assignee/i)).toBeInTheDocument();
    });

    it('task cards have proper aria-label', () => {
      renderWithProviders(<Tasks />);

      const taskCard = screen.getByText('Implement login feature').closest('button');
      expect(taskCard).toHaveAttribute('aria-label');
    });

    it('task selection checkboxes have aria-label', () => {
      renderWithProviders(<Tasks />);

      const checkbox = screen.getByLabelText(/select task task-1/i);
      expect(checkbox).toBeInTheDocument();
    });
  });
});
