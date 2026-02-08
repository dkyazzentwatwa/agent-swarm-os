import { Component } from 'react';
import { Panel } from './ui/Panel';

/**
 * ErrorBoundary component that catches React errors and displays a fallback UI
 *
 * Features:
 * - Catches errors in child component tree
 * - Displays user-friendly error message
 * - Provides error details in expandable section
 * - Offers recovery actions (retry, reload, go home)
 * - Logs errors to console for debugging
 *
 * Usage:
 * <ErrorBoundary fallback={<CustomFallback />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      errorInfo,
    });

    // Optional: Send error to logging service
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call optional reset callback
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-background p-8">
          <div className="mx-auto max-w-2xl">
            <Panel>
              <div role="alert" className="space-y-6">
                {/* Error Icon */}
                <div className="flex justify-center">
                  <div className="rounded-full bg-[color-mix(in_srgb,var(--status-error)_20%,transparent)] p-4">
                    <svg
                      className="h-12 w-12 text-[var(--status-error)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                </div>

                {/* Error Message */}
                <div className="text-center">
                  <h2 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">
                    {this.props.title || 'Something went wrong'}
                  </h2>
                  <p className="text-[var(--text-secondary)]">
                    {this.props.message ||
                     "We're sorry, but something unexpected happened. The error has been logged and you can try one of the recovery options below."}
                  </p>
                </div>

                {/* Error Details (Expandable) */}
                {this.state.error && (
                  <details className="rounded-md border border-border bg-[var(--surface-2)] p-4">
                    <summary className="cursor-pointer text-sm font-medium text-[var(--text-primary)] hover:text-[var(--interactive-active)]">
                      Show error details
                    </summary>
                    <div className="mt-4 space-y-2">
                      <div>
                        <h3 className="text-xs font-semibold text-[var(--text-secondary)]">Error Message:</h3>
                        <pre className="mt-1 overflow-x-auto rounded bg-[var(--surface-3)] p-2 text-xs text-[var(--text-primary)]">
                          {this.state.error.toString()}
                        </pre>
                      </div>
                      {this.state.errorInfo && this.state.errorInfo.componentStack && (
                        <div>
                          <h3 className="text-xs font-semibold text-[var(--text-secondary)]">Component Stack:</h3>
                          <pre className="mt-1 overflow-x-auto rounded bg-[var(--surface-3)] p-2 text-xs text-[var(--text-primary)]">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}

                {/* Recovery Actions */}
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={this.handleReset}
                    className="rounded-md bg-[var(--interactive-active)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--interactive-active)] focus:ring-offset-2"
                  >
                    Try again
                  </button>
                  <button
                    onClick={this.handleReload}
                    className="rounded-md border border-border bg-[var(--surface-1)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--interactive-active)] focus:ring-offset-2"
                  >
                    Reload page
                  </button>
                  <button
                    onClick={this.handleGoHome}
                    className="rounded-md border border-border bg-[var(--surface-1)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--interactive-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--interactive-active)] focus:ring-offset-2"
                  >
                    Go to home
                  </button>
                </div>

                {/* Support Message */}
                <div className="rounded-md bg-[var(--surface-2)] p-4 text-center text-xs text-[var(--text-secondary)]">
                  <p>
                    If this problem persists, please check the browser console for more details or report the issue at{' '}
                    <a
                      href="https://github.com/anthropics/claude-code/issues"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--interactive-active)] hover:underline"
                    >
                      github.com/anthropics/claude-code/issues
                    </a>
                  </p>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-friendly wrapper for ErrorBoundary
 * Allows using ErrorBoundary with function components
 */
export function withErrorBoundary(Component, errorBoundaryProps = {}) {
  const WrappedComponent = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}
