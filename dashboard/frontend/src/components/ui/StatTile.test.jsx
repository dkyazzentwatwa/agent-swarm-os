import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  describe('Display Mode (No onClick)', () => {
    it('renders label and value correctly', () => {
      render(<StatTile label="Test Label" value="42" />);

      expect(screen.getByText('Test Label')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renders helper text when provided', () => {
      render(
        <StatTile
          label="Test Label"
          value="42"
          helper="This is helper text"
        />
      );

      expect(screen.getByText('This is helper text')).toBeInTheDocument();
    });

    it('does not render helper text when not provided', () => {
      const { container } = render(<StatTile label="Test Label" value="42" />);

      // Helper text has specific styling, check it's not in DOM
      const helperElements = container.querySelectorAll('.text-xs.text-\\[var\\(--text-tertiary\\)\\]');
      expect(helperElements.length).toBe(0);
    });

    it('renders with different status colors', () => {
      const { container, rerender } = render(
        <StatTile label="Test" value="1" status="success" />
      );

      // Check success status dot
      let statusDot = container.querySelector('.bg-\\[var\\(--status-success\\)\\]');
      expect(statusDot).toBeInTheDocument();

      // Check warning status
      rerender(<StatTile label="Test" value="1" status="warning" />);
      statusDot = container.querySelector('.bg-\\[var\\(--status-warn\\)\\]');
      expect(statusDot).toBeInTheDocument();

      // Check error status
      rerender(<StatTile label="Test" value="1" status="error" />);
      statusDot = container.querySelector('.bg-\\[var\\(--status-error\\)\\]');
      expect(statusDot).toBeInTheDocument();

      // Check info status
      rerender(<StatTile label="Test" value="1" status="info" />);
      statusDot = container.querySelector('.bg-\\[var\\(--status-info\\)\\]');
      expect(statusDot).toBeInTheDocument();

      // Check neutral status (default)
      rerender(<StatTile label="Test" value="1" status="neutral" />);
      statusDot = container.querySelector('.bg-\\[var\\(--text-tertiary\\)\\]');
      expect(statusDot).toBeInTheDocument();
    });

    it('renders as a div when no onClick provided', () => {
      const { container } = render(<StatTile label="Test" value="42" />);

      const tile = container.firstChild;
      expect(tile.tagName).toBe('DIV');
      expect(tile).not.toHaveAttribute('tabIndex');
    });
  });

  describe('Interactive Mode (With onClick)', () => {
    it('renders as a button when onClick is provided', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <StatTile label="Test" value="42" onClick={handleClick} />
      );

      const tile = container.firstChild;
      expect(tile.tagName).toBe('BUTTON');
      expect(tile).toHaveAttribute('tabIndex', '0');
    });

    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<StatTile label="Test" value="42" onClick={handleClick} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('has proper aria-label for accessibility', () => {
      const handleClick = vi.fn();

      render(
        <StatTile
          label="Active Agents"
          value="3/5"
          helper="Click to view details"
          onClick={handleClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute(
        'aria-label',
        'Active Agents: 3/5. Click to view details'
      );
    });

    it('has proper aria-label without helper text', () => {
      const handleClick = vi.fn();

      render(
        <StatTile
          label="Tasks Completed"
          value="42"
          onClick={handleClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Tasks Completed: 42');
    });

    it('is keyboard accessible with Enter key', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<StatTile label="Test" value="42" onClick={handleClick} />);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('is keyboard accessible with Space key', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<StatTile label="Test" value="42" onClick={handleClick} />);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard(' ');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('has hover and focus styles when interactive', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <StatTile label="Test" value="42" onClick={handleClick} />
      );

      const button = container.firstChild;

      // Check for hover class
      expect(button.className).toContain('hover:bg-[var(--interactive-hover)]');

      // Check for focus ring classes
      expect(button.className).toContain('focus:outline-none');
      expect(button.className).toContain('focus:ring-2');
      expect(button.className).toContain('focus:ring-[var(--interactive-active)]');
    });
  });

  describe('Icon Rendering', () => {
    it('renders custom icon when provided', () => {
      const TestIcon = () => <svg data-testid="test-icon">Icon</svg>;

      render(
        <StatTile label="Test" value="42" icon={<TestIcon />} />
      );

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('hides icon from screen readers when interactive', () => {
      const TestIcon = () => <svg data-testid="test-icon">Icon</svg>;
      const handleClick = vi.fn();

      const { container } = render(
        <StatTile
          label="Test"
          value="42"
          icon={<TestIcon />}
          onClick={handleClick}
        />
      );

      const iconContainer = screen.getByTestId('test-icon').parentElement;
      expect(iconContainer).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <StatTile
          label="Test"
          value="42"
          className="custom-class"
        />
      );

      const tile = container.firstChild;
      expect(tile.className).toContain('custom-class');
    });

    it('preserves base classes when custom className is provided', () => {
      const { container } = render(
        <StatTile
          label="Test"
          value="42"
          className="custom-class"
        />
      );

      const tile = container.firstChild;
      expect(tile.className).toContain('rounded-lg');
      expect(tile.className).toContain('border-border');
      expect(tile.className).toContain('custom-class');
    });
  });
});
