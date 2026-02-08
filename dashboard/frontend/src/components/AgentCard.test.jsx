import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentCard } from './AgentCard';

// Mock AgentAvatar component
vi.mock('./AgentAvatar', () => ({
  AgentAvatar: ({ agent, size }) => (
    <div data-testid="agent-avatar" data-agent={agent.name} data-size={size}>
      {agent.emoji || '🤖'}
    </div>
  ),
}));

describe('AgentCard', () => {
  const baseAgent = {
    name: 'agent-researcher',
    display: 'Research Agent',
    role: 'research',
    groupLabel: 'Research Team',
    status: 'idle',
    emoji: '🔬',
  };

  describe('Agent Information', () => {
    it('displays agent name', () => {
      render(<AgentCard agent={baseAgent} />);
      expect(screen.getByText('Research Agent')).toBeInTheDocument();
    });

    it('falls back to titleFromId when no display name', () => {
      const agent = { ...baseAgent, display: undefined };
      render(<AgentCard agent={agent} />);

      // titleFromId should convert "agent-researcher" to "Agent Researcher"
      expect(screen.getByText(/Agent Researcher/i)).toBeInTheDocument();
    });

    it('displays group label', () => {
      render(<AgentCard agent={baseAgent} />);
      expect(screen.getByText('Research Team')).toBeInTheDocument();
    });

    it('falls back to role when no group label', () => {
      const agent = { ...baseAgent, groupLabel: undefined };
      render(<AgentCard agent={agent} />);

      // Should show role with titleFromId
      expect(screen.getByText(/research/i)).toBeInTheDocument();
    });

    it('renders AgentAvatar component', () => {
      render(<AgentCard agent={baseAgent} />);

      const avatar = screen.getByTestId('agent-avatar');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('data-agent', 'agent-researcher');
      expect(avatar).toHaveAttribute('data-size', 'md');
    });
  });

  describe('Status Display', () => {
    it('shows idle status by default', () => {
      render(<AgentCard agent={{ ...baseAgent, status: 'idle' }} />);

      expect(screen.getByText('Idle')).toBeInTheDocument();

      // Idle should have non-pulsing dot
      const { container } = render(<AgentCard agent={{ ...baseAgent, status: 'idle' }} />);
      const dot = container.querySelector('.bg-\\[var\\(--text-tertiary\\)\\]');
      expect(dot).toBeInTheDocument();
      expect(dot.className).not.toContain('animate-pulse');
    });

    it('shows working status with pulsing dot', () => {
      const { container } = render(<AgentCard agent={{ ...baseAgent, status: 'working' }} />);

      expect(screen.getByText('Working')).toBeInTheDocument();

      // Working should have pulsing green dot
      const dot = container.querySelector('.bg-\\[var\\(--status-success\\)\\]');
      expect(dot).toBeInTheDocument();
      expect(dot.className).toContain('animate-pulse');
    });

    it('shows waiting status with pulsing dot', () => {
      const { container } = render(<AgentCard agent={{ ...baseAgent, status: 'waiting' }} />);

      expect(screen.getByText('Waiting')).toBeInTheDocument();

      // Waiting should have pulsing yellow dot
      const dot = container.querySelector('.bg-\\[var\\(--status-warn\\)\\]');
      expect(dot).toBeInTheDocument();
      expect(dot.className).toContain('animate-pulse');
    });

    it('falls back to idle for unknown status', () => {
      render(<AgentCard agent={{ ...baseAgent, status: 'unknown-status' }} />);

      expect(screen.getByText('Idle')).toBeInTheDocument();
    });
  });

  describe('Activity Border Styling', () => {
    it('applies success border when working', () => {
      const { container } = render(<AgentCard agent={{ ...baseAgent, status: 'working' }} />);

      const card = container.querySelector('button');
      expect(card.className).toContain('border-[var(--status-success)]');
      expect(card.className).toContain('shadow-');
    });

    it('applies warning border when waiting', () => {
      const { container } = render(<AgentCard agent={{ ...baseAgent, status: 'waiting' }} />);

      const card = container.querySelector('button');
      expect(card.className).toContain('border-[var(--status-warn)]');
      expect(card.className).toContain('shadow-');
    });

    it('has no special border when idle', () => {
      const { container } = render(<AgentCard agent={{ ...baseAgent, status: 'idle' }} />);

      const card = container.querySelector('button');
      expect(card.className).toContain('border-border');
      expect(card.className).not.toContain('border-[var(--status-success)]');
      expect(card.className).not.toContain('border-[var(--status-warn)]');
    });
  });

  describe('Current Task Display', () => {
    it('shows current task when present', () => {
      const agent = {
        ...baseAgent,
        currentTask: 'Analyzing market research data',
      };

      render(<AgentCard agent={agent} />);

      expect(screen.getByText('Current task')).toBeInTheDocument();
      expect(screen.getByText('Analyzing market research data')).toBeInTheDocument();
    });

    it('shows "No active task" when no current task', () => {
      render(<AgentCard agent={baseAgent} />);

      expect(screen.getByText('No active task')).toBeInTheDocument();
      expect(screen.queryByText('Current task')).not.toBeInTheDocument();
    });

    it('truncates long task names', () => {
      const agent = {
        ...baseAgent,
        currentTask: 'This is a very long task description that should be truncated to prevent overflow',
      };

      const { container } = render(<AgentCard agent={agent} />);

      const taskElement = screen.getByText(/This is a very long task/);
      expect(taskElement.className).toContain('truncate');
    });
  });

  describe('Click Interaction', () => {
    it('calls onClick with agent name when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<AgentCard agent={baseAgent} onClick={handleClick} />);

      const card = screen.getByRole('button');
      await user.click(card);

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith('agent-researcher');
    });

    it('does not crash when onClick is not provided', async () => {
      const user = userEvent.setup();

      render(<AgentCard agent={baseAgent} />);

      const card = screen.getByRole('button');
      await expect(user.click(card)).resolves.not.toThrow();
    });

    it('is keyboard accessible', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<AgentCard agent={baseAgent} onClick={handleClick} />);

      const card = screen.getByRole('button');
      card.focus();

      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledWith('agent-researcher');
    });

    it('has hover state', () => {
      const { container } = render(<AgentCard agent={baseAgent} />);

      const card = container.querySelector('button');
      expect(card.className).toContain('hover:bg-[var(--interactive-hover)]');
    });
  });

  describe('Memoization', () => {
    it('renders consistently with same props', () => {
      const { container, rerender } = render(<AgentCard agent={baseAgent} />);

      const firstRender = container.innerHTML;

      rerender(<AgentCard agent={baseAgent} />);

      const secondRender = container.innerHTML;

      expect(firstRender).toBe(secondRender);
    });

    it('re-renders when status changes', () => {
      const { rerender } = render(<AgentCard agent={{ ...baseAgent, status: 'idle' }} />);

      expect(screen.getByText('Idle')).toBeInTheDocument();

      rerender(<AgentCard agent={{ ...baseAgent, status: 'working' }} />);

      expect(screen.getByText('Working')).toBeInTheDocument();
    });

    it('re-renders when current task changes', () => {
      const { rerender } = render(<AgentCard agent={{ ...baseAgent, currentTask: 'Task 1' }} />);

      expect(screen.getByText('Task 1')).toBeInTheDocument();

      rerender(<AgentCard agent={{ ...baseAgent, currentTask: 'Task 2' }} />);

      expect(screen.getByText('Task 2')).toBeInTheDocument();
    });

    it('re-renders when display name changes', () => {
      const { rerender } = render(<AgentCard agent={{ ...baseAgent, display: 'Agent A' }} />);

      expect(screen.getByText('Agent A')).toBeInTheDocument();

      rerender(<AgentCard agent={{ ...baseAgent, display: 'Agent B' }} />);

      expect(screen.getByText('Agent B')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('renders as a button', () => {
      render(<AgentCard agent={baseAgent} />);

      const card = screen.getByRole('button');
      expect(card).toBeInTheDocument();
    });

    it('has cursor pointer', () => {
      const { container } = render(<AgentCard agent={baseAgent} />);

      const card = container.querySelector('button');
      expect(card.className).toContain('cursor-pointer');
    });

    it('is keyboard focusable', () => {
      render(<AgentCard agent={baseAgent} />);

      const card = screen.getByRole('button');
      card.focus();

      expect(document.activeElement).toBe(card);
    });

    it('has text left-aligned', () => {
      const { container } = render(<AgentCard agent={baseAgent} />);

      const card = container.querySelector('button');
      expect(card.className).toContain('text-left');
    });
  });

  describe('Visual States', () => {
    it('shows working agent with all indicators', () => {
      const agent = {
        ...baseAgent,
        status: 'working',
        currentTask: 'Processing data',
      };

      const { container } = render(<AgentCard agent={agent} />);

      // Should have green border
      const card = container.querySelector('button');
      expect(card.className).toContain('border-[var(--status-success)]');

      // Should show "Working" status
      expect(screen.getByText('Working')).toBeInTheDocument();

      // Should show current task
      expect(screen.getByText('Processing data')).toBeInTheDocument();
    });

    it('shows waiting agent with all indicators', () => {
      const agent = {
        ...baseAgent,
        status: 'waiting',
        currentTask: 'Waiting for input',
      };

      const { container } = render(<AgentCard agent={agent} />);

      // Should have yellow border
      const card = container.querySelector('button');
      expect(card.className).toContain('border-[var(--status-warn)]');

      // Should show "Waiting" status
      expect(screen.getByText('Waiting')).toBeInTheDocument();

      // Should show current task
      expect(screen.getByText('Waiting for input')).toBeInTheDocument();
    });

    it('shows idle agent with minimal styling', () => {
      const { container } = render(<AgentCard agent={baseAgent} />);

      // Should have normal border
      const card = container.querySelector('button');
      expect(card.className).not.toContain('border-[var(--status-success)]');
      expect(card.className).not.toContain('border-[var(--status-warn)]');

      // Should show "Idle" status
      expect(screen.getByText('Idle')).toBeInTheDocument();

      // Should show "No active task"
      expect(screen.getByText('No active task')).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('has full width', () => {
      const { container } = render(<AgentCard agent={baseAgent} />);

      const card = container.querySelector('button');
      expect(card.className).toContain('w-full');
    });

    it('has rounded corners', () => {
      const { container } = render(<AgentCard agent={baseAgent} />);

      const card = container.querySelector('button');
      expect(card.className).toContain('rounded-lg');
    });

    it('has padding', () => {
      const { container } = render(<AgentCard agent={baseAgent} />);

      const card = container.querySelector('button');
      expect(card.className).toContain('p-4');
    });

    it('has transition effects', () => {
      const { container } = render(<AgentCard agent={baseAgent} />);

      const card = container.querySelector('button');
      expect(card.className).toContain('transition-colors');
    });
  });

  describe('Status Dot Animation', () => {
    it('animates dot for working status', () => {
      const { container } = render(<AgentCard agent={{ ...baseAgent, status: 'working' }} />);

      const dot = container.querySelector('.animate-pulse');
      expect(dot).toBeInTheDocument();
    });

    it('animates dot for waiting status', () => {
      const { container } = render(<AgentCard agent={{ ...baseAgent, status: 'waiting' }} />);

      const dot = container.querySelector('.animate-pulse');
      expect(dot).toBeInTheDocument();
    });

    it('does not animate dot for idle status', () => {
      const { container } = render(<AgentCard agent={{ ...baseAgent, status: 'idle' }} />);

      const dots = container.querySelectorAll('.animate-pulse');
      // Should not have any pulsing dots
      expect(dots.length).toBe(0);
    });
  });
});
