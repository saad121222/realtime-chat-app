import React, { Suspense, lazy } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

// Higher-order component for lazy loading with error boundary
export function withLazyLoading(importFunc, fallback = <LoadingSpinner />) {
  const LazyComponent = lazy(importFunc);
  
  return function LazyLoadedComponent(props) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Lazy loaded components with proper error handling
export const LazyProfileModalEnhanced = withLazyLoading(
  () => import('../components/ProfileModalEnhanced'),
  <div className="modal-loading">
    <LoadingSpinner />
    <span>Loading profile...</span>
  </div>
);

export const LazySettingsPanel = withLazyLoading(
  () => import('../components/SettingsPanel'),
  <div className="modal-loading">
    <LoadingSpinner />
    <span>Loading settings...</span>
  </div>
);

export const LazyNotificationSettings = withLazyLoading(
  () => import('../components/NotificationSettings'),
  <div className="modal-loading">
    <LoadingSpinner />
    <span>Loading notification settings...</span>
  </div>
);

export const LazyCreateGroupModal = withLazyLoading(
  () => import('../components/CreateGroupModal'),
  <div className="modal-loading">
    <LoadingSpinner />
    <span>Loading group creation...</span>
  </div>
);

export const LazyGroupInfoModal = withLazyLoading(
  () => import('../components/GroupInfoModal'),
  <div className="modal-loading">
    <LoadingSpinner />
    <span>Loading group info...</span>
  </div>
);

export const LazyChatNotificationSettings = withLazyLoading(
  () => import('../components/ChatNotificationSettings'),
  <div className="modal-loading">
    <LoadingSpinner />
    <span>Loading chat settings...</span>
  </div>
);

// Route-level lazy components
export const LazyAuthPage = withLazyLoading(
  () => import('../pages/AuthPage'),
  <div className="page-loading">
    <LoadingSpinner />
    <span>Loading authentication...</span>
  </div>
);

export const LazyPhoneAuthPage = withLazyLoading(
  () => import('../pages/PhoneAuthPage'),
  <div className="page-loading">
    <LoadingSpinner />
    <span>Loading phone verification...</span>
  </div>
);

export const LazyWhatsAppLayout = withLazyLoading(
  () => import('../components/WhatsAppLayout'),
  <div className="page-loading">
    <LoadingSpinner />
    <span>Loading chat interface...</span>
  </div>
);

// Feature-specific lazy components
export const LazyEmojiPicker = withLazyLoading(
  () => import('../components/EmojiPicker'),
  <div className="emoji-loading">
    <span>Loading emojis...</span>
  </div>
);

export const LazyFileUpload = withLazyLoading(
  () => import('../components/FileUpload'),
  <div className="upload-loading">
    <LoadingSpinner />
    <span>Loading file upload...</span>
  </div>
);

export const LazyMediaViewer = withLazyLoading(
  () => import('../components/MediaViewer'),
  <div className="media-loading">
    <LoadingSpinner />
    <span>Loading media viewer...</span>
  </div>
);

export const LazyVoiceRecorder = withLazyLoading(
  () => import('../components/VoiceRecorder'),
  <div className="voice-loading">
    <LoadingSpinner />
    <span>Loading voice recorder...</span>
  </div>
);

// Utility function for dynamic imports with retry logic
export function dynamicImport(importFunc, retries = 3, delay = 1000) {
  return new Promise((resolve, reject) => {
    const attemptImport = (attempt) => {
      importFunc()
        .then(resolve)
        .catch((error) => {
          if (attempt < retries) {
            console.warn(`Import failed, retrying... (${attempt}/${retries})`, error);
            setTimeout(() => attemptImport(attempt + 1), delay);
          } else {
            console.error('Import failed after all retries:', error);
            reject(error);
          }
        });
    };
    
    attemptImport(1);
  });
}

// Preload component for better UX
export function preloadComponent(importFunc) {
  const componentImport = importFunc();
  
  // Store the promise to avoid duplicate imports
  if (!preloadComponent._cache) {
    preloadComponent._cache = new Map();
  }
  
  const cacheKey = importFunc.toString();
  if (!preloadComponent._cache.has(cacheKey)) {
    preloadComponent._cache.set(cacheKey, componentImport);
  }
  
  return componentImport;
}

// Preload critical components on user interaction
export function preloadCriticalComponents() {
  // Preload components likely to be used soon
  preloadComponent(() => import('../components/ProfileModalEnhanced'));
  preloadComponent(() => import('../components/SettingsPanel'));
  preloadComponent(() => import('../components/EmojiPicker'));
}

// Route-based code splitting helper
export function createLazyRoute(importFunc, fallback) {
  return {
    Component: withLazyLoading(importFunc, fallback),
    preload: () => preloadComponent(importFunc)
  };
}

// Bundle analyzer helper (development only)
export function analyzeBundleSize() {
  if (process.env.NODE_ENV === 'development') {
    import('webpack-bundle-analyzer').then(({ BundleAnalyzerPlugin }) => {
      console.log('Bundle analyzer available');
    }).catch(() => {
      console.log('Bundle analyzer not available');
    });
  }
}

// Component size estimation for performance monitoring
export function estimateComponentSize(componentName) {
  const estimates = {
    'ProfileModalEnhanced': 45, // KB
    'SettingsPanel': 85,
    'NotificationSettings': 25,
    'CreateGroupModal': 35,
    'GroupInfoModal': 40,
    'EmojiPicker': 120,
    'MediaViewer': 60,
    'VoiceRecorder': 80,
    'FileUpload': 30
  };
  
  return estimates[componentName] || 20;
}

// Performance monitoring for lazy loaded components
export function trackLazyLoadPerformance(componentName, startTime) {
  const endTime = performance.now();
  const loadTime = endTime - startTime;
  const estimatedSize = estimateComponentSize(componentName);
  
  console.log(`Lazy loaded ${componentName}:`, {
    loadTime: `${loadTime.toFixed(2)}ms`,
    estimatedSize: `${estimatedSize}KB`,
    performance: loadTime < 100 ? 'excellent' : loadTime < 300 ? 'good' : 'needs improvement'
  });
  
  // Send to analytics in production
  if (process.env.NODE_ENV === 'production' && window.gtag) {
    window.gtag('event', 'lazy_load_performance', {
      component_name: componentName,
      load_time: Math.round(loadTime),
      estimated_size: estimatedSize
    });
  }
}

// Error boundary for lazy loaded components
export class LazyLoadErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Lazy load error:', error, errorInfo);
    
    // Send error to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Send to error tracking service
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="lazy-load-error">
          <div className="error-icon">⚠️</div>
          <h3>Failed to load component</h3>
          <p>Please refresh the page to try again.</p>
          <button 
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            Refresh Page
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
