import React from 'react';

export default function LoadingSpinner({ 
  size = 'medium', 
  color = 'primary', 
  text = '',
  fullScreen = false,
  className = ''
}) {
  const sizeClasses = {
    small: 'spinner-small',
    medium: 'spinner-medium',
    large: 'spinner-large'
  };

  const colorClasses = {
    primary: 'spinner-primary',
    secondary: 'spinner-secondary',
    white: 'spinner-white'
  };

  const spinnerClass = `loading-spinner ${sizeClasses[size]} ${colorClasses[color]} ${className}`;

  if (fullScreen) {
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          <div className={spinnerClass}>
            <div className="spinner-circle"></div>
          </div>
          {text && <p className="loading-text">{text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="loading-container">
      <div className={spinnerClass}>
        <div className="spinner-circle"></div>
      </div>
      {text && <span className="loading-text">{text}</span>}
    </div>
  );
}
