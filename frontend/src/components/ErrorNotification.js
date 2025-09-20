import React, { useState, useEffect } from 'react';
import { useErrorHandler } from './ErrorBoundary';
import toast from 'react-hot-toast';

// User-friendly error notification component
export default function ErrorNotification({ 
  error, 
  onRetry, 
  onDismiss, 
  autoHide = true,
  hideDelay = 5000,
  showDetails = false,
  position = 'top-right'
}) {
  const [isVisible, setIsVisible] = useState(true);
  const [showDetailedInfo, setShowDetailedInfo] = useState(false);
  const { reportError } = useErrorHandler();

  useEffect(() => {
    if (autoHide && hideDelay > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, hideDelay);

      return () => clearTimeout(timer);
    }
  }, [autoHide, hideDelay]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleRetry = () => {
    onRetry?.();
    handleDismiss();
  };

  const handleReportError = () => {
    reportError(error, {
      userReported: true,
      userDescription: prompt('Please describe what you were doing when this error occurred:')
    });
    toast.success('Error reported. Thank you for helping us improve!');
  };

  if (!isVisible || !error) return null;

  const getErrorIcon = () => {
    switch (error.severity) {
      case 'critical': return '🚨';
      case 'high': return '❌';
      case 'medium': return '⚠️';
      case 'low': return 'ℹ️';
      default: return '⚠️';
    }
  };

  const getErrorClass = () => {
    return `error-notification ${error.severity || 'medium'} ${position}`;
  };

  return (
    <div className={getErrorClass()}>
      <div className="error-content">
        <div className="error-header">
          <span className="error-icon">{getErrorIcon()}</span>
          <div className="error-text">
            <h4 className="error-title">
              {error.title || 'Something went wrong'}
            </h4>
            <p className="error-message">
              {error.userMessage || error.message || 'An unexpected error occurred'}
            </p>
          </div>
          <button 
            className="error-close"
            onClick={handleDismiss}
            title="Dismiss"
          >
            ×
          </button>
        </div>

        {showDetails && (
          <div className="error-details">
            <button
              className="toggle-details"
              onClick={() => setShowDetailedInfo(!showDetailedInfo)}
            >
              {showDetailedInfo ? 'Hide' : 'Show'} Details
            </button>
            
            {showDetailedInfo && (
              <div className="detailed-info">
                <div className="error-info-item">
                  <strong>Error Type:</strong> {error.type}
                </div>
                <div className="error-info-item">
                  <strong>Time:</strong> {new Date(error.timestamp).toLocaleString()}
                </div>
                {error.errorId && (
                  <div className="error-info-item">
                    <strong>Error ID:</strong> {error.errorId}
                  </div>
                )}
                {error.stack && (
                  <div className="error-info-item">
                    <strong>Stack Trace:</strong>
                    <pre className="error-stack">{error.stack}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="error-actions">
          {onRetry && error.retryable && (
            <button 
              className="btn-primary btn-sm"
              onClick={handleRetry}
            >
              Try Again
            </button>
          )}
          
          <button 
            className="btn-secondary btn-sm"
            onClick={handleReportError}
          >
            Report Error
          </button>
          
          <button 
            className="btn-outline btn-sm"
            onClick={handleDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast-based error notifications
export function showErrorToast(error, options = {}) {
  const {
    duration = 4000,
    position = 'top-center',
    style = {},
    onRetry,
    showRetry = false
  } = options;

  const getToastIcon = () => {
    switch (error.severity) {
      case 'critical': return '🚨';
      case 'high': return '❌';
      case 'medium': return '⚠️';
      case 'low': return 'ℹ️';
      default: return '⚠️';
    }
  };

  const message = error.userMessage || error.message || 'An error occurred';

  if (showRetry && onRetry && error.retryable) {
    return toast.error(
      (t) => (
        <div className="toast-error-content">
          <span>{message}</span>
          <div className="toast-actions">
            <button
              className="toast-retry-btn"
              onClick={() => {
                onRetry();
                toast.dismiss(t.id);
              }}
            >
              Retry
            </button>
            <button
              className="toast-dismiss-btn"
              onClick={() => toast.dismiss(t.id)}
            >
              ×
            </button>
          </div>
        </div>
      ),
      {
        duration,
        position,
        style: {
          background: '#ef4444',
          color: 'white',
          ...style
        },
        icon: getToastIcon()
      }
    );
  }

  return toast.error(message, {
    duration,
    position,
    style: {
      background: '#ef4444',
      color: 'white',
      ...style
    },
    icon: getToastIcon()
  });
}

// Success notification for error recovery
export function showSuccessToast(message, options = {}) {
  return toast.success(message, {
    duration: 3000,
    position: 'top-center',
    style: {
      background: '#22c55e',
      color: 'white'
    },
    icon: '✅',
    ...options
  });
}

// Warning notification
export function showWarningToast(message, options = {}) {
  return toast(message, {
    duration: 4000,
    position: 'top-center',
    style: {
      background: '#f59e0b',
      color: 'white'
    },
    icon: '⚠️',
    ...options
  });
}

// Info notification
export function showInfoToast(message, options = {}) {
  return toast(message, {
    duration: 3000,
    position: 'top-center',
    style: {
      background: '#3b82f6',
      color: 'white'
    },
    icon: 'ℹ️',
    ...options
  });
}

// Loading notification with error handling
export function showLoadingToast(message, promise, options = {}) {
  return toast.promise(
    promise,
    {
      loading: message,
      success: options.successMessage || 'Operation completed successfully',
      error: (error) => {
        const errorMessage = error.userMessage || error.message || 'Operation failed';
        return errorMessage;
      }
    },
    {
      position: 'top-center',
      style: {
        minWidth: '250px'
      },
      success: {
        duration: 3000,
        icon: '✅'
      },
      error: {
        duration: 5000,
        icon: '❌'
      },
      ...options
    }
  );
}

// Network status notifications
export function showNetworkError() {
  return toast.error('Network connection lost. Please check your internet connection.', {
    duration: 6000,
    position: 'top-center',
    icon: '🌐',
    id: 'network-error' // Prevent duplicates
  });
}

export function showNetworkRecovered() {
  toast.dismiss('network-error');
  return toast.success('Network connection restored', {
    duration: 3000,
    position: 'top-center',
    icon: '🌐'
  });
}

// Maintenance mode notification
export function showMaintenanceNotification() {
  return toast.error('Service is temporarily unavailable for maintenance. Please try again later.', {
    duration: 10000,
    position: 'top-center',
    icon: '🔧',
    id: 'maintenance-mode'
  });
}

// Rate limit notification
export function showRateLimitNotification(retryAfter = null) {
  const message = retryAfter 
    ? `Too many requests. Please wait ${retryAfter} seconds before trying again.`
    : 'Too many requests. Please slow down and try again.';
    
  return toast.error(message, {
    duration: 6000,
    position: 'top-center',
    icon: '⏱️'
  });
}

// Permission denied notification
export function showPermissionDeniedNotification() {
  return toast.error('Permission denied. You don\'t have access to perform this action.', {
    duration: 5000,
    position: 'top-center',
    icon: '🔒'
  });
}

// File upload error notifications
export function showFileUploadError(error) {
  const message = error.userMessage || error.message || 'File upload failed';
  
  return toast.error(message, {
    duration: 5000,
    position: 'top-center',
    icon: '📁'
  });
}

// Socket connection notifications
export function showSocketError(error) {
  const message = error.userMessage || 'Connection to chat server lost';
  
  return toast.error(message, {
    duration: 4000,
    position: 'bottom-center',
    icon: '🔌'
  });
}

export function showSocketReconnected() {
  return toast.success('Reconnected to chat server', {
    duration: 3000,
    position: 'bottom-center',
    icon: '🔌'
  });
}

// Generic error notification hook
export function useErrorNotification() {
  const showError = (error, options = {}) => {
    return showErrorToast(error, options);
  };

  const showSuccess = (message, options = {}) => {
    return showSuccessToast(message, options);
  };

  const showWarning = (message, options = {}) => {
    return showWarningToast(message, options);
  };

  const showInfo = (message, options = {}) => {
    return showInfoToast(message, options);
  };

  const showLoading = (message, promise, options = {}) => {
    return showLoadingToast(message, promise, options);
  };

  return {
    showError,
    showSuccess,
    showWarning,
    showInfo,
    showLoading,
    showNetworkError,
    showNetworkRecovered,
    showMaintenanceNotification,
    showRateLimitNotification,
    showPermissionDeniedNotification,
    showFileUploadError,
    showSocketError,
    showSocketReconnected
  };
}
