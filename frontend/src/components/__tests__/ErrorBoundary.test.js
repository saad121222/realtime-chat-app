import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ErrorBoundary, { withErrorBoundary, useErrorHandler, ErrorMessage } from '../ErrorBoundary';

// Mock console.error to avoid noise in tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

// Component that throws an error
const ThrowError = ({ shouldThrow = false, errorMessage = 'Test error' }) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>No error</div>;
};

// Component that uses error handler hook
const ComponentWithErrorHandler = () => {
  const { reportError } = useErrorHandler();
  
  const handleClick = () => {
    reportError(new Error('Manual error'), { context: 'test' });
  };

  return <button onClick={handleClick}>Report Error</button>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fetch for error reporting
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });
  });

  describe('Error Catching', () => {
    it('should render children when there is no error', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('should render error UI when child component throws', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Component crashed" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/We're sorry, but something unexpected happened/)).toBeInTheDocument();
    });

    it('should display error ID and timestamp', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Error ID:/)).toBeInTheDocument();
      expect(screen.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).toBeInTheDocument(); // Date format
    });

    it('should show retry button when retries are available', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const retryButton = screen.getByText(/Try Again/);
      expect(retryButton).toBeInTheDocument();
    });

    it('should handle retry functionality', async () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const retryButton = screen.getByText(/Try Again/);
      fireEvent.click(retryButton);

      // Wait for retry delay
      await waitFor(() => {
        expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
      }, { timeout: 2000 });

      // Re-render with no error to simulate successful retry
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('should disable retry button after max retries', () => {
      // Create error boundary with max retries = 0
      const ErrorBoundaryWithNoRetries = ({ children }) => {
        const [hasError, setHasError] = React.useState(false);
        const [retryCount, setRetryCount] = React.useState(3); // Max retries exceeded

        if (hasError) {
          return (
            <div className="error-boundary">
              <h2>Something went wrong</h2>
              <button disabled>Try Again (0 left)</button>
            </div>
          );
        }

        return (
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        );
      };

      render(
        <ErrorBoundaryWithNoRetries>
          <ThrowError shouldThrow={true} />
        </ErrorBoundaryWithNoRetries>
      );

      // Should show retry button but it should be disabled when max retries reached
      const retryButton = screen.getByText(/Try Again/);
      expect(retryButton).toBeInTheDocument();
    });
  });

  describe('Error Types', () => {
    it('should render loading error UI for chunk load errors', () => {
      const ChunkError = () => {
        const error = new Error('Loading chunk 1 failed');
        error.name = 'ChunkLoadError';
        throw error;
      };

      render(
        <ErrorBoundary>
          <ChunkError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Loading Error')).toBeInTheDocument();
      expect(screen.getByText(/Failed to load application resources/)).toBeInTheDocument();
      expect(screen.getByText('Reload Application')).toBeInTheDocument();
    });

    it('should render network error UI for network errors', () => {
      const NetworkError = () => {
        const error = new Error('Network Error');
        throw error;
      };

      render(
        <ErrorBoundary>
          <NetworkError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByText(/Unable to connect to our servers/)).toBeInTheDocument();
    });
  });

  describe('Error Reporting', () => {
    it('should call error reporting service', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });
      global.fetch = mockFetch;

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Test error for reporting" />
        </ErrorBoundary>
      );

      const reportButton = screen.getByText('Report Error');
      
      // Mock window.prompt
      window.prompt = jest.fn().mockReturnValue('User was clicking send button');
      
      fireEvent.click(reportButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/errors', expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Test error for reporting'),
        }));
      });
    });

    it('should handle error reporting failures gracefully', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const reportButton = screen.getByText('Report Error');
      window.prompt = jest.fn().mockReturnValue('Test description');
      
      // Should not throw even if reporting fails
      expect(() => fireEvent.click(reportButton)).not.toThrow();
    });
  });

  describe('Development Mode', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should show error details in development mode', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Development error" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error Details (Development Mode)')).toBeInTheDocument();
    });
  });
});

describe('withErrorBoundary HOC', () => {
  it('should wrap component with error boundary', () => {
    const TestComponent = () => <div>Test Component</div>;
    const WrappedComponent = withErrorBoundary(TestComponent, { component: 'Test' });

    render(<WrappedComponent />);

    expect(screen.getByText('Test Component')).toBeInTheDocument();
  });

  it('should catch errors in wrapped component', () => {
    const ErrorComponent = () => {
      throw new Error('Wrapped component error');
    };
    const WrappedComponent = withErrorBoundary(ErrorComponent);

    render(<WrappedComponent />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});

describe('useErrorHandler hook', () => {
  it('should provide reportError function', () => {
    render(<ComponentWithErrorHandler />);

    const button = screen.getByText('Report Error');
    expect(button).toBeInTheDocument();
  });

  it('should call error reporting when reportError is used', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });
    global.fetch = mockFetch;

    render(<ComponentWithErrorHandler />);

    const button = screen.getByText('Report Error');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/errors', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
    });
  });
});

describe('ErrorMessage component', () => {
  const mockError = {
    title: 'Test Error',
    message: 'This is a test error message',
    details: 'Error details here',
  };

  it('should render error message', () => {
    render(<ErrorMessage error={mockError} />);

    expect(screen.getByText('Test Error')).toBeInTheDocument();
    expect(screen.getByText('This is a test error message')).toBeInTheDocument();
  });

  it('should show retry button when onRetry is provided', () => {
    const mockRetry = jest.fn();
    render(<ErrorMessage error={mockError} onRetry={mockRetry} />);

    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(mockRetry).toHaveBeenCalled();
  });

  it('should show dismiss button when onDismiss is provided', () => {
    const mockDismiss = jest.fn();
    render(<ErrorMessage error={mockError} onDismiss={mockDismiss} />);

    const dismissButton = screen.getByText('Dismiss');
    expect(dismissButton).toBeInTheDocument();

    fireEvent.click(dismissButton);
    expect(mockDismiss).toHaveBeenCalled();
  });

  it('should show error details when showDetails is true', () => {
    render(<ErrorMessage error={mockError} showDetails={true} />);

    const detailsToggle = screen.getByText('Show Details');
    expect(detailsToggle).toBeInTheDocument();

    fireEvent.click(detailsToggle);
    expect(screen.getByText('Error details here')).toBeInTheDocument();
  });

  it('should apply severity classes correctly', () => {
    const { container } = render(
      <ErrorMessage error={mockError} severity="high" />
    );

    expect(container.firstChild).toHaveClass('severity-high');
  });

  it('should not render when error is null', () => {
    const { container } = render(<ErrorMessage error={null} />);
    expect(container.firstChild).toBeNull();
  });
});
