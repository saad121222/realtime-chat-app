// Centralized error monitoring and logging service
class ErrorMonitoringService {
  constructor() {
    this.isInitialized = false;
    this.config = {
      apiEndpoint: '/api/monitoring/errors',
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000,
      enableConsoleLogging: process.env.NODE_ENV === 'development',
      enableRemoteLogging: process.env.NODE_ENV === 'production',
      enableLocalStorage: true,
      maxLocalStorageSize: 100, // Max errors to store locally
      enablePerformanceMonitoring: true,
      enableUserInteractionTracking: false // Privacy-conscious default
    };
    
    // Error queues
    this.errorQueue = [];
    this.performanceQueue = [];
    this.userInteractionQueue = [];
    
    // Batch processing
    this.batchTimer = null;
    this.isProcessingBatch = false;
    
    // Error statistics
    this.stats = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      errorsToday: 0,
      lastError: null,
      startTime: Date.now()
    };
    
    // User context
    this.userContext = {
      userId: null,
      sessionId: this.generateSessionId(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      cookieEnabled: navigator.cookieEnabled
    };
    
    // Performance monitoring
    this.performanceObserver = null;
    this.vitals = {
      fcp: null, // First Contentful Paint
      lcp: null, // Largest Contentful Paint
      fid: null, // First Input Delay
      cls: null, // Cumulative Layout Shift
      ttfb: null // Time to First Byte
    };
    
    this.init();
  }

  init() {
    if (this.isInitialized) return;
    
    try {
      // Setup global error handlers
      this.setupGlobalErrorHandlers();
      
      // Setup performance monitoring
      if (this.config.enablePerformanceMonitoring) {
        this.setupPerformanceMonitoring();
      }
      
      // Setup user interaction tracking
      if (this.config.enableUserInteractionTracking) {
        this.setupUserInteractionTracking();
      }
      
      // Start batch processing
      this.startBatchProcessing();
      
      // Setup cleanup on page unload
      this.setupCleanupHandlers();
      
      // Load user context
      this.loadUserContext();
      
      this.isInitialized = true;
      console.log('📊 Error monitoring service initialized');
      
    } catch (error) {
      console.error('Failed to initialize error monitoring:', error);
    }
  }

  setupGlobalErrorHandlers() {
    // JavaScript errors
    window.addEventListener('error', (event) => {
      this.captureError({
        type: 'javascript_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        severity: 'high',
        category: 'runtime'
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        type: 'unhandled_promise_rejection',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        severity: 'high',
        category: 'promise'
      });
    });

    // Resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.captureError({
          type: 'resource_error',
          message: `Failed to load resource: ${event.target.src || event.target.href}`,
          element: event.target.tagName,
          source: event.target.src || event.target.href,
          severity: 'medium',
          category: 'resource'
        });
      }
    }, true);

    // Console error override (optional)
    if (this.config.enableConsoleLogging) {
      const originalConsoleError = console.error;
      console.error = (...args) => {
        this.captureError({
          type: 'console_error',
          message: args.join(' '),
          severity: 'medium',
          category: 'console'
        });
        originalConsoleError.apply(console, args);
      };
    }
  }

  setupPerformanceMonitoring() {
    // Web Vitals monitoring
    if ('PerformanceObserver' in window) {
      // First Contentful Paint
      this.observePerformanceEntry('paint', (entries) => {
        entries.forEach(entry => {
          if (entry.name === 'first-contentful-paint') {
            this.vitals.fcp = entry.startTime;
            this.capturePerformanceMetric('fcp', entry.startTime);
          }
        });
      });

      // Largest Contentful Paint
      this.observePerformanceEntry('largest-contentful-paint', (entries) => {
        const lastEntry = entries[entries.length - 1];
        this.vitals.lcp = lastEntry.startTime;
        this.capturePerformanceMetric('lcp', lastEntry.startTime);
      });

      // First Input Delay
      this.observePerformanceEntry('first-input', (entries) => {
        const firstInput = entries[0];
        this.vitals.fid = firstInput.processingStart - firstInput.startTime;
        this.capturePerformanceMetric('fid', this.vitals.fid);
      });

      // Cumulative Layout Shift
      this.observePerformanceEntry('layout-shift', (entries) => {
        let cls = 0;
        entries.forEach(entry => {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        });
        this.vitals.cls = cls;
        this.capturePerformanceMetric('cls', cls);
      });

      // Navigation timing
      this.observePerformanceEntry('navigation', (entries) => {
        const navigation = entries[0];
        this.vitals.ttfb = navigation.responseStart - navigation.requestStart;
        this.capturePerformanceMetric('ttfb', this.vitals.ttfb);
      });

      // Long tasks (performance issues)
      this.observePerformanceEntry('longtask', (entries) => {
        entries.forEach(entry => {
          if (entry.duration > 50) { // Tasks longer than 50ms
            this.captureError({
              type: 'performance_issue',
              message: `Long task detected: ${entry.duration.toFixed(2)}ms`,
              duration: entry.duration,
              severity: 'medium',
              category: 'performance'
            });
          }
        });
      });
    }

    // Memory monitoring (if available)
    if ('memory' in performance) {
      setInterval(() => {
        const memInfo = performance.memory;
        const memoryPressure = memInfo.usedJSHeapSize / memInfo.totalJSHeapSize;
        
        if (memoryPressure > 0.9) {
          this.captureError({
            type: 'memory_pressure',
            message: `High memory usage: ${(memoryPressure * 100).toFixed(1)}%`,
            memoryUsage: {
              used: memInfo.usedJSHeapSize,
              total: memInfo.totalJSHeapSize,
              limit: memInfo.jsHeapSizeLimit
            },
            severity: 'high',
            category: 'performance'
          });
        }
      }, 60000); // Check every minute
    }
  }

  observePerformanceEntry(type, callback) {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ entryTypes: [type] });
    } catch (error) {
      console.warn(`Failed to observe ${type} performance entries:`, error);
    }
  }

  setupUserInteractionTracking() {
    // Track user interactions that lead to errors
    const interactionEvents = ['click', 'keydown', 'submit', 'focus'];
    
    interactionEvents.forEach(eventType => {
      document.addEventListener(eventType, (event) => {
        this.captureUserInteraction({
          type: eventType,
          target: this.getElementSelector(event.target),
          timestamp: Date.now()
        });
      }, { passive: true });
    });
  }

  setupCleanupHandlers() {
    // Flush errors before page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });

    // Flush errors when page becomes hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flush();
      }
    });
  }

  loadUserContext() {
    try {
      // Load user ID from localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      this.userContext.userId = user.id || 'anonymous';
      
      // Load additional context from sessionStorage
      const sessionContext = JSON.parse(sessionStorage.getItem('errorContext') || '{}');
      this.userContext = { ...this.userContext, ...sessionContext };
      
    } catch (error) {
      console.warn('Failed to load user context:', error);
    }
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Main error capture method
  captureError(errorData) {
    try {
      const enrichedError = this.enrichError(errorData);
      
      // Update statistics
      this.updateErrorStats(enrichedError);
      
      // Add to queue
      this.errorQueue.push(enrichedError);
      
      // Store locally if enabled
      if (this.config.enableLocalStorage) {
        this.storeErrorLocally(enrichedError);
      }
      
      // Log to console if enabled
      if (this.config.enableConsoleLogging) {
        console.error('📊 Error captured:', enrichedError);
      }
      
      // Process immediately for critical errors
      if (enrichedError.severity === 'critical') {
        this.flush();
      }
      
    } catch (error) {
      console.error('Failed to capture error:', error);
    }
  }

  enrichError(errorData) {
    return {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer,
      userContext: this.userContext,
      browserInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      },
      pageInfo: {
        title: document.title,
        url: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash
      },
      performanceInfo: {
        vitals: { ...this.vitals },
        timing: this.getNavigationTiming(),
        memory: this.getMemoryInfo()
      },
      recentInteractions: this.getRecentUserInteractions(),
      ...errorData
    };
  }

  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  updateErrorStats(error) {
    this.stats.totalErrors++;
    this.stats.lastError = error;
    
    // Count by type
    this.stats.errorsByType[error.type] = (this.stats.errorsByType[error.type] || 0) + 1;
    
    // Count by severity
    this.stats.errorsBySeverity[error.severity] = (this.stats.errorsBySeverity[error.severity] || 0) + 1;
    
    // Count today's errors
    const today = new Date().toDateString();
    const errorDate = new Date(error.timestamp).toDateString();
    if (today === errorDate) {
      this.stats.errorsToday++;
    }
  }

  capturePerformanceMetric(metric, value) {
    this.performanceQueue.push({
      id: this.generateErrorId(),
      type: 'performance_metric',
      metric,
      value,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userContext: this.userContext
    });
  }

  captureUserInteraction(interaction) {
    this.userInteractionQueue.push({
      ...interaction,
      id: this.generateErrorId()
    });
    
    // Keep only last 10 interactions
    if (this.userInteractionQueue.length > 10) {
      this.userInteractionQueue.shift();
    }
  }

  getRecentUserInteractions() {
    return this.userInteractionQueue.slice(-5); // Last 5 interactions
  }

  getNavigationTiming() {
    if (!('performance' in window) || !performance.timing) return null;
    
    const timing = performance.timing;
    return {
      navigationStart: timing.navigationStart,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      loadComplete: timing.loadEventEnd - timing.navigationStart,
      domInteractive: timing.domInteractive - timing.navigationStart
    };
  }

  getMemoryInfo() {
    if (!('memory' in performance)) return null;
    
    const memory = performance.memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    };
  }

  getElementSelector(element) {
    if (!element) return null;
    
    // Generate a simple CSS selector for the element
    let selector = element.tagName.toLowerCase();
    
    if (element.id) {
      selector += `#${element.id}`;
    }
    
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    return selector;
  }

  storeErrorLocally(error) {
    try {
      const errors = JSON.parse(localStorage.getItem('errorLog') || '[]');
      errors.push(error);
      
      // Keep only recent errors
      if (errors.length > this.config.maxLocalStorageSize) {
        errors.splice(0, errors.length - this.config.maxLocalStorageSize);
      }
      
      localStorage.setItem('errorLog', JSON.stringify(errors));
    } catch (error) {
      console.warn('Failed to store error locally:', error);
    }
  }

  startBatchProcessing() {
    this.batchTimer = setInterval(() => {
      if (this.errorQueue.length > 0 || this.performanceQueue.length > 0) {
        this.processBatch();
      }
    }, this.config.flushInterval);
  }

  async processBatch() {
    if (this.isProcessingBatch) return;
    
    this.isProcessingBatch = true;
    
    try {
      const batch = {
        errors: this.errorQueue.splice(0, this.config.batchSize),
        performance: this.performanceQueue.splice(0, this.config.batchSize),
        timestamp: new Date().toISOString(),
        sessionId: this.userContext.sessionId
      };
      
      if (batch.errors.length > 0 || batch.performance.length > 0) {
        await this.sendBatch(batch);
      }
      
    } catch (error) {
      console.error('Failed to process error batch:', error);
      
      // Re-queue errors on failure
      this.errorQueue.unshift(...batch.errors);
      this.performanceQueue.unshift(...batch.performance);
      
    } finally {
      this.isProcessingBatch = false;
    }
  }

  async sendBatch(batch, retryCount = 0) {
    if (!this.config.enableRemoteLogging) return;
    
    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log(`📊 Sent batch with ${batch.errors.length} errors and ${batch.performance.length} metrics`);
      
    } catch (error) {
      console.error('Failed to send error batch:', error);
      
      // Retry with exponential backoff
      if (retryCount < this.config.maxRetries) {
        const delay = this.config.retryDelay * Math.pow(2, retryCount);
        setTimeout(() => {
          this.sendBatch(batch, retryCount + 1);
        }, delay);
      }
    }
  }

  // Manual error reporting
  reportError(error, context = {}) {
    this.captureError({
      type: 'manual_report',
      message: error.message || String(error),
      stack: error.stack,
      severity: context.severity || 'medium',
      category: context.category || 'manual',
      ...context
    });
  }

  // Manual performance reporting
  reportPerformance(metric, value, context = {}) {
    this.capturePerformanceMetric(metric, value);
  }

  // Set user context
  setUserContext(context) {
    this.userContext = { ...this.userContext, ...context };
    
    // Store in sessionStorage
    try {
      sessionStorage.setItem('errorContext', JSON.stringify(context));
    } catch (error) {
      console.warn('Failed to store user context:', error);
    }
  }

  // Add breadcrumb
  addBreadcrumb(message, category = 'info', level = 'info') {
    this.captureUserInteraction({
      type: 'breadcrumb',
      message,
      category,
      level,
      timestamp: Date.now()
    });
  }

  // Flush all queued errors immediately
  async flush() {
    if (this.errorQueue.length > 0 || this.performanceQueue.length > 0) {
      await this.processBatch();
    }
  }

  // Get error statistics
  getStats() {
    return {
      ...this.stats,
      queuedErrors: this.errorQueue.length,
      queuedPerformance: this.performanceQueue.length,
      uptime: Date.now() - this.stats.startTime
    };
  }

  // Clear local error log
  clearLocalErrors() {
    try {
      localStorage.removeItem('errorLog');
      this.errorQueue = [];
      this.performanceQueue = [];
      console.log('📊 Local error log cleared');
    } catch (error) {
      console.error('Failed to clear local errors:', error);
    }
  }

  // Destroy the service
  destroy() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    // Flush remaining errors
    this.flush();
    
    this.isInitialized = false;
    console.log('📊 Error monitoring service destroyed');
  }
}

// Create singleton instance
const errorMonitoring = new ErrorMonitoringService();

// Export for manual usage
export const reportError = (error, context) => errorMonitoring.reportError(error, context);
export const reportPerformance = (metric, value, context) => errorMonitoring.reportPerformance(metric, value, context);
export const setUserContext = (context) => errorMonitoring.setUserContext(context);
export const addBreadcrumb = (message, category, level) => errorMonitoring.addBreadcrumb(message, category, level);
export const getErrorStats = () => errorMonitoring.getStats();
export const clearLocalErrors = () => errorMonitoring.clearLocalErrors();

export default errorMonitoring;
