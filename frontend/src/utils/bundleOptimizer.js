// Bundle optimization utilities and webpack configuration helpers
import { lazy } from 'react';

// Bundle analysis and optimization utilities
export class BundleOptimizer {
  constructor() {
    this.chunkMap = new Map();
    this.loadedChunks = new Set();
    this.preloadedChunks = new Set();
    this.criticalChunks = new Set(['main', 'vendor', 'runtime']);
    
    this.config = {
      preloadThreshold: 0.7, // Preload when 70% likely to be needed
      maxConcurrentPreloads: 3,
      chunkSizeThreshold: 244 * 1024, // 244KB recommended chunk size
      compressionEnabled: true,
      treeshakingEnabled: true
    };
    
    this.init();
  }

  init() {
    this.setupChunkTracking();
    this.setupPreloadStrategy();
    this.setupPerformanceMonitoring();
  }

  // Track chunk loading
  setupChunkTracking() {
    if (typeof window !== 'undefined' && window.__webpack_require__) {
      const originalEnsure = window.__webpack_require__.e;
      
      window.__webpack_require__.e = (chunkId) => {
        this.trackChunkLoad(chunkId);
        return originalEnsure(chunkId);
      };
    }
  }

  trackChunkLoad(chunkId) {
    const startTime = performance.now();
    
    this.chunkMap.set(chunkId, {
      id: chunkId,
      loadStartTime: startTime,
      loadEndTime: null,
      size: null,
      critical: this.criticalChunks.has(chunkId)
    });

    // Track when chunk finishes loading
    setTimeout(() => {
      const chunkInfo = this.chunkMap.get(chunkId);
      if (chunkInfo) {
        chunkInfo.loadEndTime = performance.now();
        chunkInfo.loadDuration = chunkInfo.loadEndTime - chunkInfo.loadStartTime;
        this.loadedChunks.add(chunkId);
      }
    }, 0);
  }

  // Intelligent preloading strategy
  setupPreloadStrategy() {
    // Preload based on user behavior patterns
    this.setupRoutePreloading();
    this.setupInteractionPreloading();
    this.setupIdlePreloading();
  }

  setupRoutePreloading() {
    // Preload likely next routes based on current route
    const routePreloadMap = {
      '/': ['/chat', '/settings'],
      '/chat': ['/profile', '/settings'],
      '/profile': ['/settings'],
      '/auth': ['/phone-auth', '/chat']
    };

    const currentPath = window.location.pathname;
    const preloadRoutes = routePreloadMap[currentPath] || [];
    
    preloadRoutes.forEach(route => {
      this.preloadRoute(route);
    });
  }

  setupInteractionPreloading() {
    // Preload on hover/focus with debouncing
    let preloadTimeout;
    
    document.addEventListener('mouseover', (event) => {
      const link = event.target.closest('[data-preload]');
      if (link) {
        clearTimeout(preloadTimeout);
        preloadTimeout = setTimeout(() => {
          this.preloadComponent(link.dataset.preload);
        }, 100);
      }
    });

    document.addEventListener('mouseout', () => {
      clearTimeout(preloadTimeout);
    });
  }

  setupIdlePreloading() {
    // Preload during idle time
    if ('requestIdleCallback' in window) {
      const preloadDuringIdle = (deadline) => {
        while (deadline.timeRemaining() > 0 && this.hasMoreToPreload()) {
          this.preloadNextChunk();
        }
        
        requestIdleCallback(preloadDuringIdle);
      };
      
      requestIdleCallback(preloadDuringIdle);
    }
  }

  // Preload specific route
  async preloadRoute(route) {
    const routeChunkMap = {
      '/chat': () => import('../components/WhatsAppLayout'),
      '/profile': () => import('../components/ProfileModalEnhanced'),
      '/settings': () => import('../components/SettingsPanel'),
      '/phone-auth': () => import('../pages/PhoneAuthPage')
    };

    const importFunc = routeChunkMap[route];
    if (importFunc && !this.preloadedChunks.has(route)) {
      try {
        this.preloadedChunks.add(route);
        await importFunc();
        console.log(`Preloaded route: ${route}`);
      } catch (error) {
        console.warn(`Failed to preload route ${route}:`, error);
        this.preloadedChunks.delete(route);
      }
    }
  }

  // Preload specific component
  async preloadComponent(componentName) {
    const componentChunkMap = {
      'EmojiPicker': () => import('../components/EmojiPicker'),
      'MediaViewer': () => import('../components/MediaViewer'),
      'FileUpload': () => import('../components/FileUpload'),
      'VoiceRecorder': () => import('../components/VoiceRecorder'),
      'GroupInfoModal': () => import('../components/GroupInfoModal'),
      'CreateGroupModal': () => import('../components/CreateGroupModal')
    };

    const importFunc = componentChunkMap[componentName];
    if (importFunc && !this.preloadedChunks.has(componentName)) {
      try {
        this.preloadedChunks.add(componentName);
        await importFunc();
        console.log(`Preloaded component: ${componentName}`);
      } catch (error) {
        console.warn(`Failed to preload component ${componentName}:`, error);
        this.preloadedChunks.delete(componentName);
      }
    }
  }

  hasMoreToPreload() {
    return this.preloadedChunks.size < 10; // Arbitrary limit
  }

  preloadNextChunk() {
    // Implement logic to determine next most likely chunk to be needed
    const candidates = [
      'EmojiPicker',
      'MediaViewer',
      'FileUpload',
      'GroupInfoModal'
    ];

    const nextChunk = candidates.find(chunk => !this.preloadedChunks.has(chunk));
    if (nextChunk) {
      this.preloadComponent(nextChunk);
    }
  }

  // Performance monitoring
  setupPerformanceMonitoring() {
    // Monitor chunk loading performance
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.name.includes('chunk')) {
            this.analyzeChunkPerformance(entry);
          }
        });
      });
      
      observer.observe({ entryTypes: ['resource'] });
    }
  }

  analyzeChunkPerformance(entry) {
    const analysis = {
      name: entry.name,
      size: entry.transferSize,
      loadTime: entry.duration,
      fromCache: entry.transferSize === 0,
      compressionRatio: entry.encodedBodySize / entry.decodedBodySize
    };

    // Log performance issues
    if (analysis.loadTime > 1000) {
      console.warn('Slow chunk loading detected:', analysis);
    }

    if (analysis.size > this.config.chunkSizeThreshold) {
      console.warn('Large chunk detected:', analysis);
    }
  }

  // Get optimization recommendations
  getOptimizationRecommendations() {
    const recommendations = [];
    
    // Analyze chunk sizes
    this.chunkMap.forEach((chunk, id) => {
      if (chunk.size > this.config.chunkSizeThreshold) {
        recommendations.push({
          type: 'chunk-size',
          message: `Chunk ${id} is too large (${chunk.size} bytes)`,
          suggestion: 'Consider splitting this chunk further'
        });
      }
      
      if (chunk.loadDuration > 1000) {
        recommendations.push({
          type: 'load-time',
          message: `Chunk ${id} takes too long to load (${chunk.loadDuration}ms)`,
          suggestion: 'Consider preloading or optimizing this chunk'
        });
      }
    });

    // Check for unused preloads
    const unusedPreloads = Array.from(this.preloadedChunks).filter(chunk => 
      !this.loadedChunks.has(chunk)
    );

    if (unusedPreloads.length > 0) {
      recommendations.push({
        type: 'unused-preload',
        message: `Unused preloaded chunks: ${unusedPreloads.join(', ')}`,
        suggestion: 'Review preloading strategy'
      });
    }

    return recommendations;
  }

  // Get bundle statistics
  getStats() {
    return {
      totalChunks: this.chunkMap.size,
      loadedChunks: this.loadedChunks.size,
      preloadedChunks: this.preloadedChunks.size,
      averageLoadTime: this.getAverageLoadTime(),
      largestChunk: this.getLargestChunk(),
      recommendations: this.getOptimizationRecommendations()
    };
  }

  getAverageLoadTime() {
    const loadTimes = Array.from(this.chunkMap.values())
      .filter(chunk => chunk.loadDuration)
      .map(chunk => chunk.loadDuration);
    
    return loadTimes.length > 0 
      ? loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length 
      : 0;
  }

  getLargestChunk() {
    return Array.from(this.chunkMap.values())
      .reduce((largest, chunk) => 
        (chunk.size > (largest?.size || 0)) ? chunk : largest, null);
  }
}

// Webpack configuration helpers
export const webpackOptimizations = {
  // Code splitting configuration
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      // Vendor chunk for third-party libraries
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all',
        priority: 10,
        reuseExistingChunk: true
      },
      
      // Common chunk for shared code
      common: {
        name: 'common',
        minChunks: 2,
        chunks: 'all',
        priority: 5,
        reuseExistingChunk: true,
        enforce: true
      },
      
      // React chunk
      react: {
        test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
        name: 'react',
        chunks: 'all',
        priority: 20
      },
      
      // UI library chunk
      ui: {
        test: /[\\/]node_modules[\\/](date-fns|react-hot-toast|react-window)[\\/]/,
        name: 'ui',
        chunks: 'all',
        priority: 15
      },
      
      // Socket.io chunk
      socket: {
        test: /[\\/]node_modules[\\/]socket\.io-client[\\/]/,
        name: 'socket',
        chunks: 'all',
        priority: 15
      }
    }
  },

  // Minimize configuration
  minimize: true,
  minimizer: [
    // TerserPlugin for JS minification
    {
      terserOptions: {
        compress: {
          drop_console: process.env.NODE_ENV === 'production',
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug']
        },
        mangle: {
          safari10: true
        },
        output: {
          comments: false,
          ascii_only: true
        }
      }
    },
    
    // CSS optimization
    {
      cssProcessorOptions: {
        map: {
          inline: false,
          annotation: true
        }
      }
    }
  ],

  // Tree shaking configuration
  usedExports: true,
  sideEffects: false,

  // Module concatenation
  concatenateModules: true
};

// Bundle analysis utilities
export function analyzeBundleSize() {
  if (process.env.NODE_ENV === 'development') {
    // Dynamic import to avoid including in production bundle
    import('webpack-bundle-analyzer').then(({ BundleAnalyzerPlugin }) => {
      console.log('Bundle analyzer available - run npm run analyze');
    }).catch(() => {
      console.log('Install webpack-bundle-analyzer to analyze bundle size');
    });
  }
}

// Tree shaking helpers
export function createTreeShakableExport(obj) {
  // Mark exports as side-effect free for better tree shaking
  return Object.freeze(obj);
}

// Lazy loading with retry logic
export function createRetryableLazy(importFunc, retries = 3) {
  return lazy(() => {
    return new Promise((resolve, reject) => {
      const attemptImport = (attempt) => {
        importFunc()
          .then(resolve)
          .catch((error) => {
            if (attempt < retries) {
              console.warn(`Import failed, retrying... (${attempt}/${retries})`);
              setTimeout(() => attemptImport(attempt + 1), 1000 * attempt);
            } else {
              reject(error);
            }
          });
      };
      
      attemptImport(1);
    });
  });
}

// Resource hints for better loading
export function addResourceHints() {
  const head = document.head;
  
  // DNS prefetch for external domains
  const dnsPrefetches = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com'
  ];
  
  dnsPrefetches.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = domain;
    head.appendChild(link);
  });
  
  // Preconnect for critical external resources
  const preconnects = [
    'https://fonts.googleapis.com'
  ];
  
  preconnects.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    link.crossOrigin = 'anonymous';
    head.appendChild(link);
  });
}

// Critical CSS inlining
export function inlineCriticalCSS() {
  // This would typically be done at build time
  const criticalCSS = `
    /* Critical above-the-fold styles */
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .loading-spinner { /* spinner styles */ }
    .whatsapp-layout { display: flex; height: 100vh; }
  `;
  
  const style = document.createElement('style');
  style.textContent = criticalCSS;
  document.head.appendChild(style);
}

// Service worker for caching
export function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
}

// Performance budget monitoring
export function monitorPerformanceBudget() {
  const budgets = {
    maxBundleSize: 500 * 1024, // 500KB
    maxChunkSize: 244 * 1024,  // 244KB
    maxLoadTime: 3000,         // 3 seconds
    maxFCP: 1800,             // First Contentful Paint
    maxLCP: 2500              // Largest Contentful Paint
  };

  // Monitor bundle size
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'navigation') {
          if (entry.loadEventEnd - entry.loadEventStart > budgets.maxLoadTime) {
            console.warn('Performance budget exceeded: Load time too high');
          }
        }
        
        if (entry.entryType === 'paint') {
          if (entry.name === 'first-contentful-paint' && entry.startTime > budgets.maxFCP) {
            console.warn('Performance budget exceeded: FCP too high');
          }
        }
        
        if (entry.entryType === 'largest-contentful-paint') {
          if (entry.startTime > budgets.maxLCP) {
            console.warn('Performance budget exceeded: LCP too high');
          }
        }
      });
    });
    
    observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
  }
}

// Create singleton instance
const bundleOptimizer = new BundleOptimizer();

export default bundleOptimizer;
