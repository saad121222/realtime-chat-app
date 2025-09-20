// Advanced caching service with multiple strategies
class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.sessionCache = new Map();
    this.persistentCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
    
    // Configuration
    this.config = {
      maxMemorySize: 50 * 1024 * 1024, // 50MB
      maxSessionSize: 20 * 1024 * 1024, // 20MB
      maxPersistentSize: 100 * 1024 * 1024, // 100MB
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000, // 1 minute
      compressionThreshold: 1024 // 1KB
    };
    
    // Initialize
    this.initializePersistentCache();
    this.startCleanupTimer();
    this.setupEventListeners();
  }

  // Initialize persistent cache from localStorage/IndexedDB
  async initializePersistentCache() {
    try {
      // Try IndexedDB first, fallback to localStorage
      if ('indexedDB' in window) {
        await this.initIndexedDB();
      } else {
        this.initLocalStorage();
      }
    } catch (error) {
      console.warn('Failed to initialize persistent cache:', error);
    }
  }

  // IndexedDB initialization
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('whatsapp-cache', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.indexedDB = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('expiry', 'expiry', { unique: false });
          store.createIndex('size', 'size', { unique: false });
        }
      };
    });
  }

  // localStorage fallback
  initLocalStorage() {
    try {
      const stored = localStorage.getItem('whatsapp-cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([key, value]) => {
          if (value.expiry > Date.now()) {
            this.persistentCache.set(key, value);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Clear cache on low memory
    if ('memory' in performance) {
      setInterval(() => {
        const memInfo = performance.memory;
        const memoryPressure = memInfo.usedJSHeapSize / memInfo.totalJSHeapSize;
        
        if (memoryPressure > 0.8) {
          this.clearMemoryCache();
        }
      }, 30000);
    }

    // Save persistent cache before page unload
    window.addEventListener('beforeunload', () => {
      this.savePersistentCache();
    });

    // Handle visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.savePersistentCache();
      }
    });
  }

  // Start cleanup timer
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  // Generate cache key
  generateKey(namespace, identifier, params = {}) {
    const paramString = Object.keys(params).length > 0 
      ? JSON.stringify(params) 
      : '';
    return `${namespace}:${identifier}${paramString ? ':' + btoa(paramString) : ''}`;
  }

  // Estimate data size
  estimateSize(data) {
    return new Blob([JSON.stringify(data)]).size;
  }

  // Compress data if needed
  compress(data) {
    const serialized = JSON.stringify(data);
    if (serialized.length > this.config.compressionThreshold) {
      // Simple compression using JSON.stringify with replacer
      return {
        compressed: true,
        data: this.simpleCompress(serialized)
      };
    }
    return { compressed: false, data: serialized };
  }

  // Decompress data
  decompress(item) {
    if (item.compressed) {
      return JSON.parse(this.simpleDecompress(item.data));
    }
    return JSON.parse(item.data);
  }

  // Simple compression (in production, use a proper compression library)
  simpleCompress(str) {
    return btoa(str);
  }

  // Simple decompression
  simpleDecompress(str) {
    return atob(str);
  }

  // Set cache item
  async set(key, data, options = {}) {
    const {
      ttl = this.config.defaultTTL,
      strategy = 'memory',
      priority = 'normal',
      tags = []
    } = options;

    const now = Date.now();
    const expiry = now + ttl;
    const size = this.estimateSize(data);
    const compressed = this.compress(data);

    const cacheItem = {
      key,
      data: compressed.data,
      compressed: compressed.compressed,
      expiry,
      size,
      priority,
      tags,
      accessCount: 0,
      lastAccessed: now,
      created: now
    };

    try {
      switch (strategy) {
        case 'memory':
          await this.setMemoryCache(key, cacheItem);
          break;
        case 'session':
          await this.setSessionCache(key, cacheItem);
          break;
        case 'persistent':
          await this.setPersistentCache(key, cacheItem);
          break;
        case 'hybrid':
          // Store in memory for quick access, backup in persistent
          await this.setMemoryCache(key, cacheItem);
          await this.setPersistentCache(key, cacheItem);
          break;
        default:
          await this.setMemoryCache(key, cacheItem);
      }

      this.cacheStats.sets++;
      return true;
    } catch (error) {
      console.warn('Failed to set cache item:', error);
      return false;
    }
  }

  // Get cache item
  async get(key, options = {}) {
    const { strategy = 'memory', updateAccess = true } = options;

    let cacheItem = null;

    try {
      // Try different cache levels
      switch (strategy) {
        case 'memory':
          cacheItem = this.memoryCache.get(key);
          break;
        case 'session':
          cacheItem = this.sessionCache.get(key);
          break;
        case 'persistent':
          cacheItem = await this.getPersistentCache(key);
          break;
        case 'hybrid':
          // Try memory first, then persistent
          cacheItem = this.memoryCache.get(key);
          if (!cacheItem) {
            cacheItem = await this.getPersistentCache(key);
            // Promote to memory cache
            if (cacheItem) {
              this.memoryCache.set(key, cacheItem);
            }
          }
          break;
        default:
          cacheItem = this.memoryCache.get(key);
      }

      // Check expiry
      if (cacheItem && cacheItem.expiry < Date.now()) {
        await this.delete(key);
        cacheItem = null;
      }

      if (cacheItem) {
        // Update access statistics
        if (updateAccess) {
          cacheItem.accessCount++;
          cacheItem.lastAccessed = Date.now();
        }

        this.cacheStats.hits++;
        return this.decompress(cacheItem);
      } else {
        this.cacheStats.misses++;
        return null;
      }
    } catch (error) {
      console.warn('Failed to get cache item:', error);
      this.cacheStats.misses++;
      return null;
    }
  }

  // Memory cache operations
  async setMemoryCache(key, item) {
    // Check memory limits
    const currentSize = this.getMemoryCacheSize();
    if (currentSize + item.size > this.config.maxMemorySize) {
      await this.evictMemoryCache(item.size);
    }

    this.memoryCache.set(key, item);
  }

  // Session cache operations
  async setSessionCache(key, item) {
    const currentSize = this.getSessionCacheSize();
    if (currentSize + item.size > this.config.maxSessionSize) {
      await this.evictSessionCache(item.size);
    }

    this.sessionCache.set(key, item);
  }

  // Persistent cache operations
  async setPersistentCache(key, item) {
    if (this.indexedDB) {
      const transaction = this.indexedDB.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      await store.put(item);
    } else {
      this.persistentCache.set(key, item);
    }
  }

  async getPersistentCache(key) {
    if (this.indexedDB) {
      const transaction = this.indexedDB.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);
      
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });
    } else {
      return this.persistentCache.get(key);
    }
  }

  // Cache size calculations
  getMemoryCacheSize() {
    return Array.from(this.memoryCache.values())
      .reduce((total, item) => total + item.size, 0);
  }

  getSessionCacheSize() {
    return Array.from(this.sessionCache.values())
      .reduce((total, item) => total + item.size, 0);
  }

  // Eviction strategies
  async evictMemoryCache(requiredSpace) {
    const items = Array.from(this.memoryCache.entries())
      .map(([key, item]) => ({ key, ...item }))
      .sort((a, b) => {
        // LRU with priority consideration
        const priorityWeight = { low: 1, normal: 2, high: 3 };
        const aPriority = priorityWeight[a.priority] || 2;
        const bPriority = priorityWeight[b.priority] || 2;
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority; // Lower priority first
        }
        
        return a.lastAccessed - b.lastAccessed; // Older first
      });

    let freedSpace = 0;
    for (const item of items) {
      if (freedSpace >= requiredSpace) break;
      
      this.memoryCache.delete(item.key);
      freedSpace += item.size;
      this.cacheStats.evictions++;
    }
  }

  async evictSessionCache(requiredSpace) {
    const items = Array.from(this.sessionCache.entries())
      .map(([key, item]) => ({ key, ...item }))
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    let freedSpace = 0;
    for (const item of items) {
      if (freedSpace >= requiredSpace) break;
      
      this.sessionCache.delete(item.key);
      freedSpace += item.size;
      this.cacheStats.evictions++;
    }
  }

  // Delete cache item
  async delete(key) {
    this.memoryCache.delete(key);
    this.sessionCache.delete(key);
    
    if (this.indexedDB) {
      const transaction = this.indexedDB.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      store.delete(key);
    } else {
      this.persistentCache.delete(key);
    }
  }

  // Clear caches
  clearMemoryCache() {
    this.memoryCache.clear();
  }

  clearSessionCache() {
    this.sessionCache.clear();
  }

  async clearPersistentCache() {
    if (this.indexedDB) {
      const transaction = this.indexedDB.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      store.clear();
    } else {
      this.persistentCache.clear();
      localStorage.removeItem('whatsapp-cache');
    }
  }

  async clearAll() {
    this.clearMemoryCache();
    this.clearSessionCache();
    await this.clearPersistentCache();
  }

  // Cleanup expired items
  cleanup() {
    const now = Date.now();
    
    // Memory cache cleanup
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expiry < now) {
        this.memoryCache.delete(key);
      }
    }

    // Session cache cleanup
    for (const [key, item] of this.sessionCache.entries()) {
      if (item.expiry < now) {
        this.sessionCache.delete(key);
      }
    }

    // Persistent cache cleanup (less frequent)
    if (Math.random() < 0.1) { // 10% chance
      this.cleanupPersistentCache();
    }
  }

  async cleanupPersistentCache() {
    if (this.indexedDB) {
      const transaction = this.indexedDB.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const index = store.index('expiry');
      const range = IDBKeyRange.upperBound(Date.now());
      
      index.openCursor(range).onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    } else {
      for (const [key, item] of this.persistentCache.entries()) {
        if (item.expiry < Date.now()) {
          this.persistentCache.delete(key);
        }
      }
    }
  }

  // Save persistent cache to localStorage (fallback)
  savePersistentCache() {
    if (!this.indexedDB && this.persistentCache.size > 0) {
      try {
        const data = Object.fromEntries(this.persistentCache);
        localStorage.setItem('whatsapp-cache', JSON.stringify(data));
      } catch (error) {
        console.warn('Failed to save persistent cache:', error);
      }
    }
  }

  // Get cache statistics
  getStats() {
    return {
      ...this.cacheStats,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0,
      memoryCacheSize: this.memoryCache.size,
      sessionCacheSize: this.sessionCache.size,
      persistentCacheSize: this.persistentCache.size,
      memoryUsage: this.getMemoryCacheSize(),
      sessionUsage: this.getSessionCacheSize()
    };
  }

  // Invalidate by tags
  async invalidateByTags(tags) {
    const caches = [this.memoryCache, this.sessionCache, this.persistentCache];
    
    for (const cache of caches) {
      for (const [key, item] of cache.entries()) {
        if (item.tags && item.tags.some(tag => tags.includes(tag))) {
          await this.delete(key);
        }
      }
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

// API-specific cache helpers
export const apiCache = {
  // Cache API responses
  async get(endpoint, params = {}) {
    const key = cacheService.generateKey('api', endpoint, params);
    return await cacheService.get(key, { strategy: 'hybrid' });
  },

  async set(endpoint, params = {}, data, ttl = 5 * 60 * 1000) {
    const key = cacheService.generateKey('api', endpoint, params);
    return await cacheService.set(key, data, {
      ttl,
      strategy: 'hybrid',
      tags: ['api', endpoint.split('/')[1]]
    });
  },

  async invalidate(endpoint, params = {}) {
    const key = cacheService.generateKey('api', endpoint, params);
    return await cacheService.delete(key);
  }
};

// User data cache helpers
export const userCache = {
  async getProfile(userId) {
    const key = cacheService.generateKey('user', 'profile', { userId });
    return await cacheService.get(key, { strategy: 'persistent' });
  },

  async setProfile(userId, profile) {
    const key = cacheService.generateKey('user', 'profile', { userId });
    return await cacheService.set(key, profile, {
      ttl: 30 * 60 * 1000, // 30 minutes
      strategy: 'persistent',
      priority: 'high',
      tags: ['user', 'profile']
    });
  }
};

// Message cache helpers
export const messageCache = {
  async getMessages(chatId, page = 1) {
    const key = cacheService.generateKey('messages', chatId, { page });
    return await cacheService.get(key, { strategy: 'memory' });
  },

  async setMessages(chatId, page = 1, messages) {
    const key = cacheService.generateKey('messages', chatId, { page });
    return await cacheService.set(key, messages, {
      ttl: 10 * 60 * 1000, // 10 minutes
      strategy: 'memory',
      priority: 'high',
      tags: ['messages', chatId]
    });
  },

  async invalidateChat(chatId) {
    return await cacheService.invalidateByTags([chatId]);
  }
};

export default cacheService;
