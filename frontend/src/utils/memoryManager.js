// Memory management and leak prevention utilities
class MemoryManager {
  constructor() {
    this.observers = new Set();
    this.timers = new Set();
    this.eventListeners = new Map();
    this.subscriptions = new Set();
    this.webWorkers = new Set();
    this.mediaStreams = new Set();
    this.objectUrls = new Set();
    this.abortControllers = new Set();
    
    this.memoryStats = {
      peakUsage: 0,
      currentUsage: 0,
      leakDetections: 0,
      cleanupOperations: 0
    };
    
    this.config = {
      monitoringInterval: 30000, // 30 seconds
      memoryThreshold: 100 * 1024 * 1024, // 100MB
      leakDetectionEnabled: process.env.NODE_ENV === 'development',
      autoCleanupEnabled: true
    };
    
    this.init();
  }

  init() {
    if (this.config.leakDetectionEnabled) {
      this.startMemoryMonitoring();
      this.setupLeakDetection();
    }
    
    this.setupCleanupListeners();
  }

  // Memory monitoring
  startMemoryMonitoring() {
    if (!('memory' in performance)) return;
    
    const monitor = () => {
      const memInfo = performance.memory;
      this.memoryStats.currentUsage = memInfo.usedJSHeapSize;
      
      if (memInfo.usedJSHeapSize > this.memoryStats.peakUsage) {
        this.memoryStats.peakUsage = memInfo.usedJSHeapSize;
      }
      
      // Check for memory pressure
      if (memInfo.usedJSHeapSize > this.config.memoryThreshold) {
        this.handleMemoryPressure();
      }
      
      // Log memory stats in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Memory Stats:', {
          used: `${(memInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
          total: `${(memInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
          limit: `${(memInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
        });
      }
    };
    
    const timerId = setInterval(monitor, this.config.monitoringInterval);
    this.registerTimer(timerId);
  }

  // Leak detection setup
  setupLeakDetection() {
    // Override common leak-prone methods
    this.wrapEventListeners();
    this.wrapTimers();
    this.wrapObservers();
  }

  // Wrap addEventListener to track listeners
  wrapEventListeners() {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
    
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      const key = `${this.constructor.name}-${type}`;
      
      if (!memoryManager.eventListeners.has(key)) {
        memoryManager.eventListeners.set(key, new Set());
      }
      
      memoryManager.eventListeners.get(key).add({
        target: this,
        type,
        listener,
        options
      });
      
      return originalAddEventListener.call(this, type, listener, options);
    };
    
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      const key = `${this.constructor.name}-${type}`;
      const listeners = memoryManager.eventListeners.get(key);
      
      if (listeners) {
        for (const item of listeners) {
          if (item.target === this && item.type === type && item.listener === listener) {
            listeners.delete(item);
            break;
          }
        }
      }
      
      return originalRemoveEventListener.call(this, type, listener, options);
    };
  }

  // Wrap timer functions
  wrapTimers() {
    const originalSetTimeout = window.setTimeout;
    const originalSetInterval = window.setInterval;
    const originalClearTimeout = window.clearTimeout;
    const originalClearInterval = window.clearInterval;
    
    window.setTimeout = (callback, delay, ...args) => {
      const id = originalSetTimeout(callback, delay, ...args);
      memoryManager.timers.add(id);
      return id;
    };
    
    window.setInterval = (callback, delay, ...args) => {
      const id = originalSetInterval(callback, delay, ...args);
      memoryManager.timers.add(id);
      return id;
    };
    
    window.clearTimeout = (id) => {
      memoryManager.timers.delete(id);
      return originalClearTimeout(id);
    };
    
    window.clearInterval = (id) => {
      memoryManager.timers.delete(id);
      return originalClearInterval(id);
    };
  }

  // Wrap observer APIs
  wrapObservers() {
    const observerTypes = [
      'IntersectionObserver',
      'MutationObserver',
      'ResizeObserver',
      'PerformanceObserver'
    ];
    
    observerTypes.forEach(type => {
      if (window[type]) {
        const OriginalObserver = window[type];
        
        window[type] = function(...args) {
          const observer = new OriginalObserver(...args);
          memoryManager.observers.add(observer);
          
          const originalDisconnect = observer.disconnect;
          observer.disconnect = function() {
            memoryManager.observers.delete(observer);
            return originalDisconnect.call(this);
          };
          
          return observer;
        };
      }
    });
  }

  // Setup cleanup listeners
  setupCleanupListeners() {
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
    
    // Cleanup on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.config.autoCleanupEnabled) {
        this.partialCleanup();
      }
    });
    
    // Cleanup on memory pressure
    if ('memory' in performance) {
      window.addEventListener('memory-pressure', () => {
        this.handleMemoryPressure();
      });
    }
  }

  // Handle memory pressure
  handleMemoryPressure() {
    console.warn('Memory pressure detected, performing cleanup');
    
    // Clear caches
    if (window.cacheService) {
      window.cacheService.clearMemoryCache();
    }
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
    
    // Emit custom event
    window.dispatchEvent(new CustomEvent('memory-pressure', {
      detail: { usage: this.memoryStats.currentUsage }
    }));
  }

  // Register cleanup items
  registerTimer(id) {
    this.timers.add(id);
    return id;
  }

  registerObserver(observer) {
    this.observers.add(observer);
    return observer;
  }

  registerEventListener(target, type, listener, options) {
    const key = `${target.constructor.name}-${type}`;
    
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, new Set());
    }
    
    this.eventListeners.get(key).add({
      target,
      type,
      listener,
      options
    });
  }

  registerSubscription(subscription) {
    this.subscriptions.add(subscription);
    return subscription;
  }

  registerWebWorker(worker) {
    this.webWorkers.add(worker);
    return worker;
  }

  registerMediaStream(stream) {
    this.mediaStreams.add(stream);
    return stream;
  }

  registerObjectUrl(url) {
    this.objectUrls.add(url);
    return url;
  }

  registerAbortController(controller) {
    this.abortControllers.add(controller);
    return controller;
  }

  // Cleanup methods
  cleanup() {
    this.cleanupTimers();
    this.cleanupObservers();
    this.cleanupEventListeners();
    this.cleanupSubscriptions();
    this.cleanupWebWorkers();
    this.cleanupMediaStreams();
    this.cleanupObjectUrls();
    this.cleanupAbortControllers();
    
    this.memoryStats.cleanupOperations++;
  }

  partialCleanup() {
    // Less aggressive cleanup for when app is backgrounded
    this.cleanupUnusedTimers();
    this.cleanupInactiveObservers();
    this.cleanupOldObjectUrls();
  }

  cleanupTimers() {
    this.timers.forEach(id => {
      clearTimeout(id);
      clearInterval(id);
    });
    this.timers.clear();
  }

  cleanupUnusedTimers() {
    // Only cleanup timers that haven't been accessed recently
    // This is a simplified version - in practice, you'd track timer usage
    const now = Date.now();
    this.timers.forEach(id => {
      if (Math.random() < 0.1) { // Randomly cleanup 10% of timers
        clearTimeout(id);
        clearInterval(id);
        this.timers.delete(id);
      }
    });
  }

  cleanupObservers() {
    this.observers.forEach(observer => {
      if (observer && typeof observer.disconnect === 'function') {
        observer.disconnect();
      }
    });
    this.observers.clear();
  }

  cleanupInactiveObservers() {
    // Cleanup observers that are no longer needed
    this.observers.forEach(observer => {
      if (observer && observer.takeRecords && observer.takeRecords().length === 0) {
        observer.disconnect();
        this.observers.delete(observer);
      }
    });
  }

  cleanupEventListeners() {
    this.eventListeners.forEach((listeners, key) => {
      listeners.forEach(({ target, type, listener, options }) => {
        if (target && typeof target.removeEventListener === 'function') {
          target.removeEventListener(type, listener, options);
        }
      });
    });
    this.eventListeners.clear();
  }

  cleanupSubscriptions() {
    this.subscriptions.forEach(subscription => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    });
    this.subscriptions.clear();
  }

  cleanupWebWorkers() {
    this.webWorkers.forEach(worker => {
      if (worker && typeof worker.terminate === 'function') {
        worker.terminate();
      }
    });
    this.webWorkers.clear();
  }

  cleanupMediaStreams() {
    this.mediaStreams.forEach(stream => {
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach(track => track.stop());
      }
    });
    this.mediaStreams.clear();
  }

  cleanupObjectUrls() {
    this.objectUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.objectUrls.clear();
  }

  cleanupOldObjectUrls() {
    // In practice, you'd track creation time and cleanup old URLs
    const urlsToCleanup = Array.from(this.objectUrls).slice(0, Math.floor(this.objectUrls.size / 2));
    urlsToCleanup.forEach(url => {
      URL.revokeObjectURL(url);
      this.objectUrls.delete(url);
    });
  }

  cleanupAbortControllers() {
    this.abortControllers.forEach(controller => {
      if (controller && typeof controller.abort === 'function') {
        controller.abort();
      }
    });
    this.abortControllers.clear();
  }

  // Memory leak detection
  detectLeaks() {
    const leaks = [];
    
    // Check for excessive timers
    if (this.timers.size > 100) {
      leaks.push({
        type: 'timers',
        count: this.timers.size,
        severity: 'high'
      });
    }
    
    // Check for excessive observers
    if (this.observers.size > 50) {
      leaks.push({
        type: 'observers',
        count: this.observers.size,
        severity: 'medium'
      });
    }
    
    // Check for excessive event listeners
    let totalListeners = 0;
    this.eventListeners.forEach(listeners => {
      totalListeners += listeners.size;
    });
    
    if (totalListeners > 200) {
      leaks.push({
        type: 'eventListeners',
        count: totalListeners,
        severity: 'high'
      });
    }
    
    // Check for excessive object URLs
    if (this.objectUrls.size > 20) {
      leaks.push({
        type: 'objectUrls',
        count: this.objectUrls.size,
        severity: 'medium'
      });
    }
    
    if (leaks.length > 0) {
      this.memoryStats.leakDetections++;
      console.warn('Potential memory leaks detected:', leaks);
      
      // Emit leak detection event
      window.dispatchEvent(new CustomEvent('memory-leak-detected', {
        detail: { leaks }
      }));
    }
    
    return leaks;
  }

  // Get memory statistics
  getStats() {
    const memInfo = performance.memory || {};
    
    return {
      ...this.memoryStats,
      timers: this.timers.size,
      observers: this.observers.size,
      eventListeners: Array.from(this.eventListeners.values())
        .reduce((total, listeners) => total + listeners.size, 0),
      subscriptions: this.subscriptions.size,
      webWorkers: this.webWorkers.size,
      mediaStreams: this.mediaStreams.size,
      objectUrls: this.objectUrls.size,
      abortControllers: this.abortControllers.size,
      heapUsed: memInfo.usedJSHeapSize,
      heapTotal: memInfo.totalJSHeapSize,
      heapLimit: memInfo.jsHeapSizeLimit
    };
  }

  // Force garbage collection (if available)
  forceGC() {
    if (window.gc) {
      window.gc();
      return true;
    }
    return false;
  }
}

// Create singleton instance
const memoryManager = new MemoryManager();

// React hook for memory management
export function useMemoryCleanup(dependencies = []) {
  const React = require('react');
  const { useEffect, useRef } = React;
  
  const cleanupRef = useRef([]);
  
  useEffect(() => {
    return () => {
      // Cleanup all registered items
      cleanupRef.current.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
      cleanupRef.current = [];
    };
  }, dependencies);
  
  const registerCleanup = (cleanup) => {
    cleanupRef.current.push(cleanup);
  };
  
  return { registerCleanup };
}

// React hook for timer management
export function useTimer() {
  const React = require('react');
  const { useEffect, useRef } = React;
  
  const timersRef = useRef(new Set());
  
  useEffect(() => {
    return () => {
      timersRef.current.forEach(id => {
        clearTimeout(id);
        clearInterval(id);
      });
    };
  }, []);
  
  const setTimeout = (callback, delay) => {
    const id = window.setTimeout(callback, delay);
    timersRef.current.add(id);
    return id;
  };
  
  const setInterval = (callback, delay) => {
    const id = window.setInterval(callback, delay);
    timersRef.current.add(id);
    return id;
  };
  
  const clearTimeout = (id) => {
    timersRef.current.delete(id);
    window.clearTimeout(id);
  };
  
  const clearInterval = (id) => {
    timersRef.current.delete(id);
    window.clearInterval(id);
  };
  
  return { setTimeout, setInterval, clearTimeout, clearInterval };
}

// React hook for observer management
export function useObserver() {
  const React = require('react');
  const { useEffect, useRef } = React;
  
  const observersRef = useRef(new Set());
  
  useEffect(() => {
    return () => {
      observersRef.current.forEach(observer => {
        if (observer && typeof observer.disconnect === 'function') {
          observer.disconnect();
        }
      });
    };
  }, []);
  
  const registerObserver = (observer) => {
    observersRef.current.add(observer);
    return observer;
  };
  
  return { registerObserver };
}

// Utility functions
export function createManagedTimer(callback, delay, type = 'timeout') {
  const id = type === 'timeout' 
    ? setTimeout(callback, delay)
    : setInterval(callback, delay);
  
  memoryManager.registerTimer(id);
  return id;
}

export function createManagedObserver(ObserverClass, callback, options) {
  const observer = new ObserverClass(callback, options);
  memoryManager.registerObserver(observer);
  return observer;
}

export function createManagedEventListener(target, type, listener, options) {
  target.addEventListener(type, listener, options);
  memoryManager.registerEventListener(target, type, listener, options);
  
  return () => {
    target.removeEventListener(type, listener, options);
  };
}

export function createManagedObjectURL(blob) {
  const url = URL.createObjectURL(blob);
  memoryManager.registerObjectUrl(url);
  return url;
}

export function createManagedAbortController() {
  const controller = new AbortController();
  memoryManager.registerAbortController(controller);
  return controller;
}

// Performance monitoring
export function startPerformanceMonitoring() {
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const stats = memoryManager.getStats();
      const leaks = memoryManager.detectLeaks();
      
      console.group('Memory Management Stats');
      console.table(stats);
      if (leaks.length > 0) {
        console.warn('Potential leaks:', leaks);
      }
      console.groupEnd();
    }, 60000); // Every minute
  }
}

export default memoryManager;
