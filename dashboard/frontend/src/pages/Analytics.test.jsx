import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import Analytics from './Analytics';

// Mock the hooks
vi.mock('@/hooks/useTasks', () => ({
  useTasks: vi.fn(),
}));

vi.mock('@/hooks/useContent', () => ({
  useContent: vi.fn(),
}));

vi.mock('@/hooks/useCoffeeRoom', () => ({
  useCoffeeRoom: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: vi.fn(() => ({
      workspaceId: 'test-workspace',
      workspaceData: {
        manifest: {
          agents: [
            { id: 'agent-1', displayName: 'Agent One', emoji: '🤖', color: '#3b82f6' },
            { id: 'agent-2', displayName: 'Agent Two', emoji: '🚀', color: '#22c55e' },
          ],
          modules: [
            { id: 'module-1', label: 'Module One' },
            { id: 'module-2', label: 'Module Two' },
          ],
        },
      },
    })),
  };
});

// Mock Recharts components
vi.mock('recharts', () => ({
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }) => <div style={{ width: '100%', height: 260 }}>{children}</div>,
}));

import { useTasks } from '@/hooks/useTasks';
import { useContent } from '@/hooks/useContent';
import { useCoffeeRoom } from '@/hooks/useCoffeeRoom';

const mockTaskData = {
  tasks: [
    {
      id: 'task-1',
      subject: 'Task 1',
      status: 'completed',
      assignee: 'agent-1',
      completedAt: '2026-02-01T10:00:00.000Z',
    },
    {
      id: 'task-2',
      subject: 'Task 2',
      status: 'completed',
      assignee: 'agent-1',
      completedAt: '2026-02-02T10:00:00.000Z',
    },
    {
      id: 'task-3',
      subject: 'Task 3',
      status: 'completed',
      assignee: 'agent-2',
      completedAt: '2026-02-03T10:00:00.000Z',
    },
    {
      id: 'task-4',
      subject: 'Task 4',
      status: 'in_progress',
      assignee: 'agent-1',
    },
    {
      id: 'task-5',
      subject: 'Task 5',
      status: 'pending',
      assignee: 'agent-2',
    },
    {
      id: 'task-6',
      subject: 'Task 6',
      status: 'blocked',
      assignee: 'agent-1',
    },
  ],
  summary: {
    total: 6,
    completed: 3,
    inProgress: 1,
    pending: 1,
    blocked: 1,
  },
};

const mockArtifacts = [
  {
    modules: {
      'module-1': ['file1.md', 'file2.md'],
      'module-2': ['file3.md'],
    },
  },
  {
    modules: {
      'module-1': ['file4.md'],
    },
  },
];

const mockCommsData = {
  messages: [
    { id: 'msg-1', type: 'update', message: 'Progress update', timestamp: '2026-02-01T10:00:00.000Z' },
    { id: 'msg-2', type: 'insight', message: 'Found pattern', timestamp: '2026-02-02T10:00:00.000Z' },
    { id: 'msg-3', type: 'insight', message: 'Another insight', timestamp: '2026-02-03T10:00:00.000Z' },
    { id: 'msg-4', type: 'blocker', message: 'Blocked on API', timestamp: '2026-02-04T10:00:00.000Z' },
  ],
};

describe('Analytics Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTasks.mockReturnValue({ data: mockTaskData });
    useContent.mockReturnValue({ data: mockArtifacts });
    useCoffeeRoom.mockReturnValue({ data: mockCommsData });
  });

  describe('Page Structure', () => {
    it('renders page header', () => {
      renderWithProviders(<Analytics />);
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('Mission health, module output, and team performance')).toBeInTheDocument();
    });

    it('renders summary stat tiles', () => {
      renderWithProviders(<Analytics />);

      expect(screen.getByText('Artifacts')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument(); // Total artifacts

      expect(screen.getByText('Modules Active')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 modules

      expect(screen.getByText('Tasks Completed')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // 3 completed tasks

      expect(screen.getByText('Comms Messages')).toBeInTheDocument();
    });

    it('renders all chart panels', () => {
      renderWithProviders(<Analytics />);

      expect(screen.getByText('Module Distribution')).toBeInTheDocument();
      expect(screen.getByText('Task Status Overview')).toBeInTheDocument();
      expect(screen.getByText('Agent Throughput')).toBeInTheDocument();
      expect(screen.getByText('Comms Signal')).toBeInTheDocument();
      expect(screen.getByText('Task Completion Timeline')).toBeInTheDocument();
      expect(screen.getByText('Agent Leaderboard')).toBeInTheDocument();
    });
  });

  describe('Accessible Chart Wrappers', () => {
    it('renders figure with role="img"', () => {
      renderWithProviders(<Analytics />);

      // All charts should have role="img"
      const charts = document.querySelectorAll('figure[role="img"]');
      expect(charts.length).toBeGreaterThan(0);
    });

    it('has aria-label with data summary', () => {
      renderWithProviders(<Analytics />);

      const moduleChart = screen.getByLabelText(/Module Distribution/);
      expect(moduleChart).toBeInTheDocument();
    });

    it('has sr-only figcaption', () => {
      renderWithProviders(<Analytics />);

      const figcaptions = document.querySelectorAll('figcaption.sr-only');
      expect(figcaptions.length).toBeGreaterThan(0);
    });

    it('marks visual chart as aria-hidden', () => {
      renderWithProviders(<Analytics />);

      // The actual chart rendering should be aria-hidden
      const pieChart = screen.getByTestId('pie-chart');
      expect(pieChart.parentElement).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Data Table Toggle', () => {
    it('shows "View data table" by default', () => {
      renderWithProviders(<Analytics />);

      const viewButtons = screen.getAllByText(/View data table/i);
      expect(viewButtons.length).toBeGreaterThan(0);
    });

    it('toggles to "Hide data table" when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Analytics />);

      const viewButton = screen.getAllByText(/View data table/i)[0];
      await user.click(viewButton);

      expect(screen.getByText(/Hide data table/i)).toBeInTheDocument();
    });

    it('displays data table when toggled open', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Analytics />);

      const viewButton = screen.getAllByText(/View data table/i)[0];
      await user.click(viewButton);

      // Should show table with data
      const tables = document.querySelectorAll('table');
      expect(tables.length).toBeGreaterThan(0);
    });

    it('table has sr-only caption', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Analytics />);

      const viewButton = screen.getAllByText(/View data table/i)[0];
      await user.click(viewButton);

      const caption = document.querySelector('caption.sr-only');
      expect(caption).toBeInTheDocument();
    });

    it('table has proper headers', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Analytics />);

      // Toggle module distribution table
      const viewButtons = screen.getAllByText(/View data table/i);
      await user.click(viewButtons[0]);

      // Should have Module and Files headers
      const headers = within(document.querySelector('table')).getAllByRole('columnheader');
      expect(headers.length).toBe(2);
    });
  });

  describe('Module Distribution Chart', () => {
    it('renders pie chart for modules', () => {
      renderWithProviders(<Analytics />);

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });

    it('shows module names in data', () => {
      renderWithProviders(<Analytics />);

      // Module names should be in aria-label
      const moduleChart = screen.getByLabelText(/Module One/);
      expect(moduleChart).toBeInTheDocument();
    });

    it('shows empty state when no artifacts', () => {
      useContent.mockReturnValue({ data: [] });
      renderWithProviders(<Analytics />);

      const modulePanel = screen.getByText('Module Distribution').closest('div[class*="Panel"]');
      expect(within(modulePanel).getByText(/No artifacts yet/i)).toBeInTheDocument();
    });
  });

  describe('Task Status Chart', () => {
    it('renders bar chart for task status', () => {
      renderWithProviders(<Analytics />);

      const barCharts = screen.getAllByTestId('bar-chart');
      expect(barCharts.length).toBeGreaterThan(0);
    });

    it('shows all non-zero status counts', () => {
      renderWithProviders(<Analytics />);

      const statusChart = screen.getByLabelText(/Task Status Overview/);
      expect(statusChart).toBeInTheDocument();

      // Check for status names in aria-label
      expect(statusChart.getAttribute('aria-label')).toContain('Completed');
      expect(statusChart.getAttribute('aria-label')).toContain('In Progress');
      expect(statusChart.getAttribute('aria-label')).toContain('Pending');
      expect(statusChart.getAttribute('aria-label')).toContain('Blocked');
    });

    it('filters out zero-count statuses', async () => {
      const user = userEvent.setup();
      useTasks.mockReturnValue({
        data: {
          tasks: [],
          summary: { total: 0, completed: 5, inProgress: 0, pending: 0, blocked: 0 },
        },
      });

      renderWithProviders(<Analytics />);

      // Open data table
      const viewButton = screen.getAllByText(/View data table/i)[1]; // Status chart is second
      await user.click(viewButton);

      // Should only show Completed in table
      const rows = within(document.querySelectorAll('table')[1]).getAllByRole('row');
      // 1 header + 1 data row (only Completed)
      expect(rows.length).toBe(2);
    });

    it('shows empty state when no tasks', () => {
      useTasks.mockReturnValue({
        data: { tasks: [], summary: { total: 0, completed: 0, inProgress: 0, pending: 0, blocked: 0 } },
      });
      renderWithProviders(<Analytics />);

      const statusPanel = screen.getByText('Task Status Overview').closest('div[class*="Panel"]');
      expect(within(statusPanel).getByText(/No tasks yet/i)).toBeInTheDocument();
    });
  });

  describe('Agent Throughput Chart', () => {
    it('renders bar chart for agents', () => {
      renderWithProviders(<Analytics />);

      const barCharts = screen.getAllByTestId('bar-chart');
      expect(barCharts.length).toBeGreaterThan(0);
    });

    it('shows only agents with completed tasks', () => {
      renderWithProviders(<Analytics />);

      const agentChart = screen.getByLabelText(/Agent Throughput/);
      expect(agentChart).toBeInTheDocument();

      // Should mention Agent One (2 completed) and Agent Two (1 completed)
      expect(agentChart.getAttribute('aria-label')).toContain('Agent One');
      expect(agentChart.getAttribute('aria-label')).toContain('Agent Two');
    });

    it('shows empty state when no agents', () => {
      useTasks.mockReturnValue({
        data: {
          tasks: [{ id: 'task-1', status: 'pending', assignee: null }],
          summary: { total: 1, completed: 0, inProgress: 0, pending: 1, blocked: 0 },
        },
      });
      renderWithProviders(<Analytics />);

      const agentPanel = screen.getByText('Agent Throughput').closest('div[class*="Panel"]');
      expect(within(agentPanel).getByText(/No agents yet/i)).toBeInTheDocument();
    });
  });

  describe('Comms Signal Panel', () => {
    it('displays insight count', () => {
      renderWithProviders(<Analytics />);

      expect(screen.getByText('2')).toBeInTheDocument(); // 2 insights
      expect(screen.getByText('Insights')).toBeInTheDocument();
    });

    it('displays blocker count', () => {
      renderWithProviders(<Analytics />);

      expect(screen.getByText('1')).toBeInTheDocument(); // 1 blocker
      expect(screen.getByText('Blockers')).toBeInTheDocument();
    });

    it('displays total message count', () => {
      renderWithProviders(<Analytics />);

      const totalMessages = screen.getAllByText('4'); // 4 total messages
      expect(totalMessages.length).toBeGreaterThan(0);
      expect(screen.getByText('Total Messages')).toBeInTheDocument();
    });

    it('calculates counts correctly from message types', () => {
      useCoffeeRoom.mockReturnValue({
        data: {
          messages: [
            { id: 'msg-1', type: 'insight', message: 'Insight 1' },
            { id: 'msg-2', type: 'insight', message: 'Insight 2' },
            { id: 'msg-3', type: 'insight', message: 'Insight 3' },
            { id: 'msg-4', type: 'blocker', message: 'Blocker 1' },
            { id: 'msg-5', type: 'blocker', message: 'Blocker 2' },
            { id: 'msg-6', type: 'update', message: 'Update 1' },
          ],
        },
      });

      renderWithProviders(<Analytics />);

      expect(screen.getByText('3')).toBeInTheDocument(); // 3 insights
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 blockers
      expect(screen.getByText('6')).toBeInTheDocument(); // 6 total
    });
  });

  describe('Task Completion Timeline Chart', () => {
    it('renders area chart for timeline', () => {
      renderWithProviders(<Analytics />);

      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    it('shows last 7 completion windows', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Analytics />);

      // Open timeline data table
      const viewButtons = screen.getAllByText(/View data table/i);
      const timelineToggle = viewButtons[3]; // Timeline is 4th chart
      await user.click(timelineToggle);

      // Should have Date and Tasks Completed columns
      const table = document.querySelectorAll('table')[3];
      const headers = within(table).getAllByRole('columnheader');
      expect(headers[0]).toHaveTextContent('Date');
      expect(headers[1]).toHaveTextContent('Tasks Completed');
    });

    it('groups tasks by completion date', () => {
      renderWithProviders(<Analytics />);

      const timelineChart = screen.getByLabelText(/Task Completion Timeline/);
      expect(timelineChart).toBeInTheDocument();

      // Should mention data points and average
      expect(timelineChart.getAttribute('aria-label')).toMatch(/data points/);
      expect(timelineChart.getAttribute('aria-label')).toMatch(/average/);
    });

    it('shows empty state when no completed tasks', () => {
      useTasks.mockReturnValue({
        data: {
          tasks: [{ id: 'task-1', status: 'pending' }],
          summary: { total: 1, completed: 0, inProgress: 0, pending: 1, blocked: 0 },
        },
      });
      renderWithProviders(<Analytics />);

      expect(screen.getByText('No completed tasks yet')).toBeInTheDocument();
      expect(screen.getByText('Timeline will appear as work closes out.')).toBeInTheDocument();
    });
  });

  describe('Agent Leaderboard', () => {
    it('displays top 5 agents by completed tasks', () => {
      renderWithProviders(<Analytics />);

      expect(screen.getByText('Agent One')).toBeInTheDocument();
      expect(screen.getByText('Agent Two')).toBeInTheDocument();
    });

    it('shows medals for top 3 positions', () => {
      renderWithProviders(<Analytics />);

      const leaderboard = screen.getByText('Agent Leaderboard').closest('div[class*="Panel"]');
      const medals = within(leaderboard).getByText('🥇'); // Gold medal for 1st place
      expect(medals).toBeInTheDocument();
    });

    it('displays task counts for each agent', () => {
      renderWithProviders(<Analytics />);

      expect(screen.getByText('2 tasks completed')).toBeInTheDocument(); // Agent One
      expect(screen.getByText('1 task completed')).toBeInTheDocument(); // Agent Two
    });

    it('renders agent avatars', () => {
      renderWithProviders(<Analytics />);

      // AgentAvatar components should be present
      const leaderboard = screen.getByText('Agent Leaderboard').closest('div[class*="Panel"]');
      expect(leaderboard).toBeInTheDocument();
    });

    it('shows progress bars', () => {
      renderWithProviders(<Analytics />);

      const leaderboard = screen.getByText('Agent Leaderboard').closest('div[class*="Panel"]');
      const progressBars = within(leaderboard).queryAllByRole('presentation');
      // Progress bars are visual elements
      expect(leaderboard.querySelectorAll('.h-2.w-20').length).toBeGreaterThan(0);
    });

    it('shows empty state when no agents have completed tasks', () => {
      useTasks.mockReturnValue({
        data: {
          tasks: [{ id: 'task-1', status: 'pending', assignee: 'agent-1' }],
          summary: { total: 1, completed: 0, inProgress: 0, pending: 1, blocked: 0 },
        },
      });
      renderWithProviders(<Analytics />);

      const leaderboard = screen.getByText('Agent Leaderboard').closest('div[class*="Panel"]');
      expect(within(leaderboard).getByText(/No agents yet/i)).toBeInTheDocument();
    });

    it('sorts agents by completed task count', () => {
      useTasks.mockReturnValue({
        data: {
          tasks: [
            { id: 'task-1', status: 'completed', assignee: 'agent-2', completedAt: '2026-02-01T10:00:00.000Z' },
            { id: 'task-2', status: 'completed', assignee: 'agent-2', completedAt: '2026-02-02T10:00:00.000Z' },
            { id: 'task-3', status: 'completed', assignee: 'agent-2', completedAt: '2026-02-03T10:00:00.000Z' },
            { id: 'task-4', status: 'completed', assignee: 'agent-1', completedAt: '2026-02-04T10:00:00.000Z' },
          ],
          summary: { total: 4, completed: 4, inProgress: 0, pending: 0, blocked: 0 },
        },
      });

      renderWithProviders(<Analytics />);

      // Agent Two (3 tasks) should be first
      const leaderboard = screen.getByText('Agent Leaderboard').closest('div[class*="Panel"]');
      const agentNames = within(leaderboard).getAllByText(/Agent/);

      // First should be Agent Two
      expect(agentNames[0]).toHaveTextContent('Agent Two');
    });
  });

  describe('Data Calculations', () => {
    it('calculates total artifacts across modules', () => {
      renderWithProviders(<Analytics />);

      // 2 + 1 + 1 = 4 total artifacts
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('counts active modules correctly', () => {
      renderWithProviders(<Analytics />);

      // 2 modules have files
      const moduleTile = screen.getByText('Modules Active').closest('div');
      expect(within(moduleTile).getByText('2')).toBeInTheDocument();
    });

    it('handles empty artifact data', () => {
      useContent.mockReturnValue({ data: [] });
      renderWithProviders(<Analytics />);

      const artifactsTile = screen.getByText('Artifacts').closest('div');
      expect(within(artifactsTile).getByText('0')).toBeInTheDocument();

      const modulesTile = screen.getByText('Modules Active').closest('div');
      expect(within(modulesTile).getByText('0')).toBeInTheDocument();
    });

    it('handles empty task data', () => {
      useTasks.mockReturnValue({
        data: { tasks: [], summary: { total: 0, completed: 0, inProgress: 0, pending: 0, blocked: 0 } },
      });
      renderWithProviders(<Analytics />);

      const completedTile = screen.getByText('Tasks Completed').closest('div');
      expect(within(completedTile).getByText('0')).toBeInTheDocument();
    });

    it('handles empty comms data', () => {
      useCoffeeRoom.mockReturnValue({ data: { messages: [] } });
      renderWithProviders(<Analytics />);

      expect(screen.getByText('0')).toBeInTheDocument(); // All comms counts should be 0
    });
  });

  describe('Loading States', () => {
    it('handles undefined task data', () => {
      useTasks.mockReturnValue({ data: undefined });
      renderWithProviders(<Analytics />);

      // Should show 0s and empty states
      const completedTile = screen.getByText('Tasks Completed').closest('div');
      expect(within(completedTile).getByText('0')).toBeInTheDocument();
    });

    it('handles undefined artifact data', () => {
      useContent.mockReturnValue({ data: undefined });
      renderWithProviders(<Analytics />);

      const artifactsTile = screen.getByText('Artifacts').closest('div');
      expect(within(artifactsTile).getByText('0')).toBeInTheDocument();
    });

    it('handles undefined comms data', () => {
      useCoffeeRoom.mockReturnValue({ data: undefined });
      renderWithProviders(<Analytics />);

      // Should default to 0 messages
      expect(screen.getByText('Insights')).toBeInTheDocument();
      expect(screen.getByText('Blockers')).toBeInTheDocument();
    });
  });

  describe('Accessibility - Charts', () => {
    it('all charts have accessible wrappers', () => {
      renderWithProviders(<Analytics />);

      // Should have multiple figure elements with role="img"
      const charts = document.querySelectorAll('figure[role="img"]');
      expect(charts.length).toBeGreaterThan(3);
    });

    it('charts have descriptive aria-labels', () => {
      renderWithProviders(<Analytics />);

      const moduleChart = screen.getByLabelText(/Module Distribution/);
      expect(moduleChart.getAttribute('aria-label')).toContain('Module One');

      const statusChart = screen.getByLabelText(/Task Status Overview/);
      expect(statusChart.getAttribute('aria-label')).toContain('Completed');

      const agentChart = screen.getByLabelText(/Agent Throughput/);
      expect(agentChart.getAttribute('aria-label')).toContain('Agent');

      const timelineChart = screen.getByLabelText(/Task Completion Timeline/);
      expect(timelineChart.getAttribute('aria-label')).toContain('data points');
    });

    it('data tables are keyboard accessible', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Analytics />);

      const viewButton = screen.getAllByText(/View data table/i)[0];
      viewButton.focus();

      await user.keyboard('{Enter}');

      // Table should be visible
      expect(screen.getByText(/Hide data table/i)).toBeInTheDocument();
    });

    it('summary elements are semantic', () => {
      renderWithProviders(<Analytics />);

      const summaries = document.querySelectorAll('summary');
      expect(summaries.length).toBeGreaterThan(0);

      summaries.forEach((summary) => {
        expect(summary).toHaveTextContent(/data table/i);
      });
    });
  });

  describe('Responsive Layout', () => {
    it('uses grid layout for stat tiles', () => {
      const { container } = renderWithProviders(<Analytics />);

      const statGrid = container.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2');
      expect(statGrid).toBeInTheDocument();
    });

    it('uses grid layout for chart panels', () => {
      const { container } = renderWithProviders(<Analytics />);

      const chartGrids = container.querySelectorAll('.grid.grid-cols-1.xl\\:grid-cols-2');
      expect(chartGrids.length).toBeGreaterThan(0);
    });
  });
});
