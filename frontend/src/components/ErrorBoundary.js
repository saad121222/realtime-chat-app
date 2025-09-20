import React from 'react';
import { createMemory } from '../utils/memoryManager';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      isRetrying: false
    };
    
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    this.setState({
      error,
      errorInfo
    });

    // Log to error monitoring service
    this.logError(error, errorInfo);
    
    // Create memory for error tracking
    createMemory({
      Action: 'create',
      Title: 'Application Error Detected',
      Content: `Error: ${error.message}\nComponent Stack: ${errorInfo.componentStack}`,
      Tags: ['error', 'boundary', 'crash'],
      CorpusNames: ['c:/Users/abc92/whats'],
      UserTriggered: false
    });
  }

  logError = (error, errorInfo) => {
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
      errorId: this.state.errorId,
      retryCount: this.state.retryCount,
      props: this.props.errorMetadata || {}
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Error Data:', errorData);
      console.groupEnd();
    }

    // Send to error monitoring service
    this.sendToErrorService(errorData);
    
    // Store in local storage for offline scenarios
    this.storeErrorLocally(errorData);
  };

  getUserId = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      return user?.id || 'anonymous';
    } catch {
      return 'anonymous';
    }
  };

  getSessionId = () => {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  };

  sendToErrorService = async (errorData) => {
    try {
      // In production, replace with your error monitoring service
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/errors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(errorData),
        });
      }
      
      // Send to external services (Sentry, LogRocket, etc.)
      if (window.Sentry) {
        window.Sentry.captureException(this.state.error, {
          contexts: {
            errorBoundary: {
              componentStack: errorData.componentStack,
              errorId: errorData.errorId,
              retryCount: errorData.retryCount
            }
          }
        });
      }
    } catch (loggingError) {
      console.error('Failed to send error to monitoring service:', loggingError);
    }
  };

  storeErrorLocally = (errorData) => {
    try {
      const errors = JSON.parse(localStorage.getItem('errorLog') || '[]');
      errors.push(errorData);
      
      // Keep only last 10 errors to prevent storage bloat
      if (errors.length > 10) {
        errors.splice(0, errors.length - 10);
      }
      
      localStorage.setItem('errorLog', JSON.stringify(errors));
    } catch (storageError) {
      console.error('Failed to store error locally:', storageError);
    }
  };

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState({
        isRetrying: true
      });

      setTimeout(() => {
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: this.state.retryCount + 1,
          isRetrying: false
        });
      }, this.retryDelay * (this.state.retryCount + 1)); // Exponential backoff
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleReportError = () => {
    const errorReport = {
      errorId: this.state.errorId,
      message: this.state.error?.message,
      timestamp: new Date().toISOString(),
      userDescription: prompt('Please describe what you were doing when this error occurred:')
    };

    // Send detailed report
    this.sendToErrorService({
      ...errorReport,
      type: 'user_report',
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack
    });

    alert('Thank you for reporting this error. Our team will investigate.');
  };

  getErrorSeverity = () => {
    const error = this.state.error;
    if (!error) return 'low';

    // Classify error severity based on error type and message
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      return 'medium';
    }
    
    if (error.name === 'TypeError' && error.message.includes('Cannot read property')) {
      return 'high';
    }
    
    if (error.message.includes('Network Error') || error.message.includes('fetch')) {
      return 'medium';
    }
    
    return 'high';
  };

  getErrorCategory = () => {
    const error = this.state.error;
    if (!error) return 'unknown';

    if (error.name === 'ChunkLoadError') return 'loading';
    if (error.message.includes('Network')) return 'network';
    if (error.name === 'TypeError') return 'runtime';
    if (error.message.includes('Permission')) return 'permission';
    
    return 'runtime';
  };

  renderErrorDetails = () => {
    if (process.env.NODE_ENV !== 'development') return null;

    return (
      <details className="error-details">
        <summary>Error Details (Development Mode)</summary>
        <div className="error-info">
          <h4>Error Message:</h4>
          <pre>{this.state.error?.message}</pre>
          
          <h4>Stack Trace:</h4>
          <pre>{this.state.error?.stack}</pre>
          
          <h4>Component Stack:</h4>
          <pre>{this.state.errorInfo?.componentStack}</pre>
          
          <h4>Error Metadata:</h4>
          <pre>{JSON.stringify({
            errorId: this.state.errorId,
            retryCount: this.state.retryCount,
            severity: this.getErrorSeverity(),
            category: this.getErrorCategory(),
            timestamp: new Date().toISOString()
          }, null, 2)}</pre>
        </div>
      </details>
    );
  };

  render() {
    if (this.state.hasError) {
      const severity = this.getErrorSeverity();
      const category = this.getErrorCategory();
      const canRetry = this.state.retryCount < this.maxRetries && category !== 'loading';

      // Custom fallback UI based on error type
      if (category === 'loading') {
        return (
          <div className="error-boundary chunk-error">
            <div className="error-container">
              <div className="error-icon">📦</div>
              <h2>Loading Error</h2>
              <p>
                Failed to load application resources. This might be due to a network issue 
                or an updated version of the app.
              </p>
              
              <div className="error-actions">
                <button 
                  className="btn-primary"
                  onClick={this.handleReload}
                >
                  Reload Application
                </button>
              </div>
              
              <div className="error-meta">
                <span className="error-id">Error ID: {this.state.errorId}</span>
              </div>
            </div>
          </div>
        );
      }

      if (category === 'network') {
        return (
          <div className="error-boundary network-error">
            <div className="error-container">
              <div className="error-icon">🌐</div>
              <h2>Connection Error</h2>
              <p>
                Unable to connect to our servers. Please check your internet connection 
                and try again.
              </p>
              
              <div className="error-actions">
                {canRetry && (
                  <button 
                    className="btn-primary"
                    onClick={this.handleRetry}
                    disabled={this.state.isRetrying}
                  >
                    {this.state.isRetrying ? 'Retrying...' : `Retry (${this.maxRetries - this.state.retryCount} left)`}
                  </button>
                )}
                
                <button 
                  className="btn-secondary"
                  onClick={this.handleReload}
                >
                  Reload Page
                </button>
              </div>
              
              <div className="error-meta">
                <span className="error-id">Error ID: {this.state.errorId}</span>
              </div>
            </div>
          </div>
        );
      }

      // General error fallback
      return (
        <div className={`error-boundary general-error severity-${severity}`}>
          <div className="error-container">
            <div className="error-icon">
              {severity === 'high' ? '🚨' : severity === 'medium' ? '⚠️' : 'ℹ️'}
            </div>
            
            <h2>Something went wrong</h2>
            <p>
              We're sorry, but something unexpected happened. Our team has been notified 
              and is working to fix this issue.
            </p>
            
            <div className="error-actions">
              {canRetry && (
                <button 
                  className="btn-primary"
                  onClick={this.handleRetry}
                  disabled={this.state.isRetrying}
                >
                  {this.state.isRetrying ? 'Retrying...' : `Try Again (${this.maxRetries - this.state.retryCount} left)`}
                </button>
              )}
              
              <button 
                className="btn-secondary"
                onClick={this.handleReload}
              >
                Reload Application
              </button>
              
              <button 
                className="btn-outline"
                onClick={this.handleReportError}
              >
                Report Error
              </button>
            </div>
            
            <div className="error-meta">
              <span className="error-id">Error ID: {this.state.errorId}</span>
              <span className="error-time">{new Date().toLocaleString()}</span>
            </div>
            
            {this.renderErrorDetails()}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundaries
export function withErrorBoundary(Component, errorMetadata = {}) {
  return function WrappedComponent(props) {
    return (
      <ErrorBoundary errorMetadata={errorMetadata}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// Hook for error reporting within components
export function useErrorHandler() {
  const reportError = (error, errorInfo = {}) => {
    const errorData = {
      message: error.message || String(error),
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...errorInfo
    };

    // Log to console
    console.error('Manual error report:', errorData);

    // Send to error service
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData)
      }).catch(console.error);
    }

    // Send to external services
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        extra: errorInfo
      });
    }
  };

  return { reportError };
}

// Component for displaying error messages
export function ErrorMessage({ 
  error, 
  onRetry, 
  onDismiss, 
  severity = 'medium',
  showDetails = false 
}) {
  if (!error) return null;

  return (
    <div className={`error-message severity-${severity}`}>
      <div className="error-content">
        <div className="error-icon">
          {severity === 'high' ? '🚨' : severity === 'medium' ? '⚠️' : 'ℹ️'}
        </div>
        
        <div className="error-text">
          <h4>{error.title || 'Error'}</h4>
          <p>{error.message}</p>
          
          {showDetails && error.details && (
            <details className="error-details-inline">
              <summary>Show Details</summary>
              <pre>{error.details}</pre>
            </details>
          )}
        </div>
        
        <div className="error-actions">
          {onRetry && (
            <button className="btn-sm btn-primary" onClick={onRetry}>
              Retry
            </button>
          )}
          
          {onDismiss && (
            <button className="btn-sm btn-outline" onClick={onDismiss}>
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;
