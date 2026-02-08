import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';

// Component that throws an error
function ThrowError({ shouldThrow = true }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
}

// Suppress console.error for tests (ErrorBoundary logs errors)
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  describe('Error Catching', () => {
    it('renders children when there is no error', () => {
      render(
        <ErrorBoundary>
          <div>Child component</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child component')).toBeInTheDocument();
    });

    it('catches errors and displays fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('displays error message in fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Open error details
      const detailsToggle = screen.getByText('Show error details');
      userEvent.click(detailsToggle);

      expect(screen.getByText(/Test error message/)).toBeInTheDocument();
    });
  });

  describe('Custom Props', () => {
    it('uses custom title when provided', () => {
      render(
        <ErrorBoundary title="Custom Error Title">
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
    });

    it('uses custom message when provided', () => {
      render(
        <ErrorBoundary message="Custom error message">
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Custom error message/)).toBeInTheDocument();
    });

    it('renders custom fallback when provided', () => {
      const customFallback = <div>Custom fallback UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom fallback UI')).toBeInTheDocument();
    });
  });

  describe('Recovery Actions', () => {
    it('resets error state when "Try again" is clicked', async () => {
      const user = userEvent.setup();
      let shouldThrow = true;

      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );

      // Error is displayed
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Fix the error
      shouldThrow = false;

      // Click "Try again"
      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      await user.click(tryAgainButton);

      // Rerender with fixed component
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );

      // Children should render now
      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('calls onReset callback when reset button is clicked', async () => {
      const user = userEvent.setup();
      const onReset = vi.fn();

      render(
        <ErrorBoundary onReset={onReset}>
          <ThrowError />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      await user.click(tryAgainButton);

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('calls onError callback when error is caught', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });
  });

  describe('Error Details', () => {
    it('shows error details when expanded', async () => {
      const user = userEvent.setup();

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Initially details are hidden
      expect(screen.queryByText(/Test error message/)).not.toBeInTheDocument();

      // Click to expand details
      const detailsToggle = screen.getByText('Show error details');
      await user.click(detailsToggle);

      // Details are now visible
      expect(screen.getByText(/Test error message/)).toBeInTheDocument();
      expect(screen.getByText('Component Stack:')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA role for error alert', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('has accessible buttons with proper labels', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go to home/i })).toBeInTheDocument();
    });
  });

  describe('withErrorBoundary HOC', () => {
    it('wraps component with ErrorBoundary', () => {
      function TestComponent() {
        return <div>Test component</div>;
      }

      const WrappedComponent = withErrorBoundary(TestComponent);

      render(<WrappedComponent />);

      expect(screen.getByText('Test component')).toBeInTheDocument();
    });

    it('catches errors in wrapped component', () => {
      const WrappedComponent = withErrorBoundary(ThrowError);

      render(<WrappedComponent />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('passes props to wrapped component', () => {
      function TestComponent({ message }) {
        return <div>{message}</div>;
      }

      const WrappedComponent = withErrorBoundary(TestComponent);

      render(<WrappedComponent message="Hello world" />);

      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('sets displayName correctly', () => {
      function TestComponent() {
        return <div>Test</div>;
      }

      const WrappedComponent = withErrorBoundary(TestComponent);

      expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
    });
  });
});
