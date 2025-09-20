// Offline message queue service for PWA
class OfflineQueueService {
  constructor() {
    this.dbName = 'whatsapp-clone-offline';
    this.dbVersion = 2;
    this.db = null;
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.eventListeners = new Map();
    
    this.init();
    this.setupNetworkListeners();
  }

  async init() {
    try {
      this.db = await this.openDatabase();
      console.log('Offline queue service initialized');
      
      // Sync pending items if online
      if (this.isOnline) {
        this.syncPendingItems();
      }
    } catch (error) {
      console.error('Failed to initialize offline queue:', error);
    }
  }

  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Messages queue
        if (!db.objectStoreNames.contains('messageQueue')) {
          const messageStore = db.createObjectStore('messageQueue', { keyPath: 'id' });
          messageStore.createIndex('chatId', 'chatId', { unique: false });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
          messageStore.createIndex('priority', 'priority', { unique: false });
        }
        
        // Media queue
        if (!db.objectStoreNames.contains('mediaQueue')) {
          const mediaStore = db.createObjectStore('mediaQueue', { keyPath: 'id' });
          mediaStore.createIndex('messageId', 'messageId', { unique: false });
          mediaStore.createIndex('type', 'type', { unique: false });
        }
        
        // Profile updates queue
        if (!db.objectStoreNames.contains('profileQueue')) {
          const profileStore = db.createObjectStore('profileQueue', { keyPath: 'id' });
          profileStore.createIndex('type', 'type', { unique: false });
        }
        
        // Chat updates queue
        if (!db.objectStoreNames.contains('chatQueue')) {
          const chatStore = db.createObjectStore('chatQueue', { keyPath: 'id' });
          chatStore.createIndex('chatId', 'chatId', { unique: false });
          chatStore.createIndex('action', 'action', { unique: false });
        }
        
        // Offline cache for messages
        if (!db.objectStoreNames.contains('offlineMessages')) {
          const offlineStore = db.createObjectStore('offlineMessages', { keyPath: 'id' });
          offlineStore.createIndex('chatId', 'chatId', { unique: false });
          offlineStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        // Offline cache for chats
        if (!db.objectStoreNames.contains('offlineChats')) {
          const chatCacheStore = db.createObjectStore('offlineChats', { keyPath: 'id' });
          chatCacheStore.createIndex('lastActivity', 'lastActivity', { unique: false });
        }
      };
    });
  }

  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('Network connection restored');
      this.isOnline = true;
      this.emit('network-status', { online: true });
      this.syncPendingItems();
    });

    window.addEventListener('offline', () => {
      console.log('Network connection lost');
      this.isOnline = false;
      this.emit('network-status', { online: false });
    });
  }

  // Event emitter functionality
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  // Queue a message for offline sending
  async queueMessage(messageData) {
    if (!this.db) await this.init();
    
    const queueItem = {
      id: this.generateId(),
      type: 'message',
      chatId: messageData.chatId,
      content: messageData.content,
      messageType: messageData.messageType || 'text',
      tempId: messageData.tempId || this.generateId(),
      timestamp: Date.now(),
      priority: messageData.priority || 1,
      retryCount: 0,
      maxRetries: 3,
      token: localStorage.getItem('token'),
      userId: this.getCurrentUserId()
    };

    try {
      const transaction = this.db.transaction(['messageQueue'], 'readwrite');
      const store = transaction.objectStore('messageQueue');
      await store.add(queueItem);
      
      console.log('Message queued for offline sending:', queueItem.id);
      this.emit('message-queued', queueItem);
      
      // Try to sync immediately if online
      if (this.isOnline) {
        this.syncPendingItems();
      }
      
      return queueItem;
    } catch (error) {
      console.error('Failed to queue message:', error);
      throw error;
    }
  }

  // Queue media file for offline upload
  async queueMedia(mediaData) {
    if (!this.db) await this.init();
    
    const queueItem = {
      id: this.generateId(),
      type: 'media',
      messageId: mediaData.messageId,
      chatId: mediaData.chatId,
      file: mediaData.file,
      fileName: mediaData.fileName,
      fileType: mediaData.fileType,
      fileSize: mediaData.fileSize,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      token: localStorage.getItem('token')
    };

    try {
      const transaction = this.db.transaction(['mediaQueue'], 'readwrite');
      const store = transaction.objectStore('mediaQueue');
      await store.add(queueItem);
      
      console.log('Media queued for offline upload:', queueItem.id);
      this.emit('media-queued', queueItem);
      
      if (this.isOnline) {
        this.syncPendingItems();
      }
      
      return queueItem;
    } catch (error) {
      console.error('Failed to queue media:', error);
      throw error;
    }
  }

  // Queue profile update
  async queueProfileUpdate(profileData) {
    if (!this.db) await this.init();
    
    const queueItem = {
      id: this.generateId(),
      type: 'profile-update',
      data: profileData,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      token: localStorage.getItem('token')
    };

    try {
      const transaction = this.db.transaction(['profileQueue'], 'readwrite');
      const store = transaction.objectStore('profileQueue');
      await store.add(queueItem);
      
      console.log('Profile update queued:', queueItem.id);
      this.emit('profile-queued', queueItem);
      
      if (this.isOnline) {
        this.syncPendingItems();
      }
      
      return queueItem;
    } catch (error) {
      console.error('Failed to queue profile update:', error);
      throw error;
    }
  }

  // Queue chat action (create, update, delete)
  async queueChatAction(actionData) {
    if (!this.db) await this.init();
    
    const queueItem = {
      id: this.generateId(),
      type: 'chat-action',
      action: actionData.action, // 'create', 'update', 'delete', 'leave', 'join'
      chatId: actionData.chatId,
      data: actionData.data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      token: localStorage.getItem('token')
    };

    try {
      const transaction = this.db.transaction(['chatQueue'], 'readwrite');
      const store = transaction.objectStore('chatQueue');
      await store.add(queueItem);
      
      console.log('Chat action queued:', queueItem.id);
      this.emit('chat-action-queued', queueItem);
      
      if (this.isOnline) {
        this.syncPendingItems();
      }
      
      return queueItem;
    } catch (error) {
      console.error('Failed to queue chat action:', error);
      throw error;
    }
  }

  // Cache messages for offline viewing
  async cacheMessages(chatId, messages) {
    if (!this.db) await this.init();
    
    try {
      const transaction = this.db.transaction(['offlineMessages'], 'readwrite');
      const store = transaction.objectStore('offlineMessages');
      
      for (const message of messages) {
        const cacheItem = {
          ...message,
          chatId,
          cachedAt: Date.now()
        };
        
        await store.put(cacheItem);
      }
      
      console.log(`Cached ${messages.length} messages for chat ${chatId}`);
      this.emit('messages-cached', { chatId, count: messages.length });
    } catch (error) {
      console.error('Failed to cache messages:', error);
    }
  }

  // Cache chat data for offline viewing
  async cacheChats(chats) {
    if (!this.db) await this.init();
    
    try {
      const transaction = this.db.transaction(['offlineChats'], 'readwrite');
      const store = transaction.objectStore('offlineChats');
      
      for (const chat of chats) {
        const cacheItem = {
          ...chat,
          cachedAt: Date.now()
        };
        
        await store.put(cacheItem);
      }
      
      console.log(`Cached ${chats.length} chats`);
      this.emit('chats-cached', { count: chats.length });
    } catch (error) {
      console.error('Failed to cache chats:', error);
    }
  }

  // Get cached messages for offline viewing
  async getCachedMessages(chatId) {
    if (!this.db) await this.init();
    
    try {
      const transaction = this.db.transaction(['offlineMessages'], 'readonly');
      const store = transaction.objectStore('offlineMessages');
      const index = store.index('chatId');
      const messages = await index.getAll(chatId);
      
      return messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } catch (error) {
      console.error('Failed to get cached messages:', error);
      return [];
    }
  }

  // Get cached chats for offline viewing
  async getCachedChats() {
    if (!this.db) await this.init();
    
    try {
      const transaction = this.db.transaction(['offlineChats'], 'readonly');
      const store = transaction.objectStore('offlineChats');
      const chats = await store.getAll();
      
      return chats.sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0));
    } catch (error) {
      console.error('Failed to get cached chats:', error);
      return [];
    }
  }

  // Sync all pending items
  async syncPendingItems() {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }
    
    this.syncInProgress = true;
    console.log('Starting sync of pending items...');
    
    try {
      await Promise.all([
        this.syncMessages(),
        this.syncMedia(),
        this.syncProfileUpdates(),
        this.syncChatActions()
      ]);
      
      console.log('Sync completed successfully');
      this.emit('sync-completed', { success: true });
    } catch (error) {
      console.error('Sync failed:', error);
      this.emit('sync-completed', { success: false, error });
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync pending messages
  async syncMessages() {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['messageQueue'], 'readwrite');
    const store = transaction.objectStore('messageQueue');
    const messages = await store.getAll();
    
    for (const message of messages) {
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${message.token}`
          },
          body: JSON.stringify({
            chatId: message.chatId,
            content: message.content,
            messageType: message.messageType,
            tempId: message.tempId
          })
        });
        
        if (response.ok) {
          await store.delete(message.id);
          console.log('Message synced successfully:', message.id);
          this.emit('message-synced', { id: message.id, tempId: message.tempId });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to sync message:', error);
        
        message.retryCount++;
        if (message.retryCount >= message.maxRetries) {
          await store.delete(message.id);
          console.log('Message sync failed after max retries:', message.id);
          this.emit('message-sync-failed', { id: message.id, error: error.message });
        } else {
          await store.put(message);
        }
      }
    }
  }

  // Sync pending media
  async syncMedia() {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['mediaQueue'], 'readwrite');
    const store = transaction.objectStore('mediaQueue');
    const mediaItems = await store.getAll();
    
    for (const media of mediaItems) {
      try {
        const formData = new FormData();
        formData.append('file', media.file);
        formData.append('messageId', media.messageId);
        formData.append('chatId', media.chatId);
        
        const response = await fetch('/api/files/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${media.token}`
          },
          body: formData
        });
        
        if (response.ok) {
          await store.delete(media.id);
          console.log('Media synced successfully:', media.id);
          this.emit('media-synced', { id: media.id, messageId: media.messageId });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to sync media:', error);
        
        media.retryCount++;
        if (media.retryCount >= media.maxRetries) {
          await store.delete(media.id);
          console.log('Media sync failed after max retries:', media.id);
          this.emit('media-sync-failed', { id: media.id, error: error.message });
        } else {
          await store.put(media);
        }
      }
    }
  }

  // Sync profile updates
  async syncProfileUpdates() {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['profileQueue'], 'readwrite');
    const store = transaction.objectStore('profileQueue');
    const updates = await store.getAll();
    
    for (const update of updates) {
      try {
        const response = await fetch('/api/users/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${update.token}`
          },
          body: JSON.stringify(update.data)
        });
        
        if (response.ok) {
          await store.delete(update.id);
          console.log('Profile update synced successfully:', update.id);
          this.emit('profile-synced', { id: update.id });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to sync profile update:', error);
        
        update.retryCount++;
        if (update.retryCount >= update.maxRetries) {
          await store.delete(update.id);
          console.log('Profile update sync failed after max retries:', update.id);
          this.emit('profile-sync-failed', { id: update.id, error: error.message });
        } else {
          await store.put(update);
        }
      }
    }
  }

  // Sync chat actions
  async syncChatActions() {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['chatQueue'], 'readwrite');
    const store = transaction.objectStore('chatQueue');
    const actions = await store.getAll();
    
    for (const action of actions) {
      try {
        let response;
        
        switch (action.action) {
          case 'create':
            response = await fetch('/api/chats', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${action.token}`
              },
              body: JSON.stringify(action.data)
            });
            break;
            
          case 'update':
            response = await fetch(`/api/chats/${action.chatId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${action.token}`
              },
              body: JSON.stringify(action.data)
            });
            break;
            
          case 'delete':
            response = await fetch(`/api/chats/${action.chatId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${action.token}`
              }
            });
            break;
            
          case 'leave':
            response = await fetch(`/api/chats/${action.chatId}/leave`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${action.token}`
              }
            });
            break;
            
          case 'join':
            response = await fetch(`/api/chats/${action.chatId}/join`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${action.token}`
              },
              body: JSON.stringify(action.data)
            });
            break;
            
          default:
            throw new Error(`Unknown action: ${action.action}`);
        }
        
        if (response.ok) {
          await store.delete(action.id);
          console.log('Chat action synced successfully:', action.id);
          this.emit('chat-action-synced', { id: action.id, action: action.action });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to sync chat action:', error);
        
        action.retryCount++;
        if (action.retryCount >= action.maxRetries) {
          await store.delete(action.id);
          console.log('Chat action sync failed after max retries:', action.id);
          this.emit('chat-action-sync-failed', { id: action.id, error: error.message });
        } else {
          await store.put(action);
        }
      }
    }
  }

  // Get queue statistics
  async getQueueStats() {
    if (!this.db) await this.init();
    
    try {
      const stats = {
        messages: 0,
        media: 0,
        profile: 0,
        chatActions: 0,
        total: 0
      };
      
      const messageTransaction = this.db.transaction(['messageQueue'], 'readonly');
      const messageStore = messageTransaction.objectStore('messageQueue');
      stats.messages = await messageStore.count();
      
      const mediaTransaction = this.db.transaction(['mediaQueue'], 'readonly');
      const mediaStore = mediaTransaction.objectStore('mediaQueue');
      stats.media = await mediaStore.count();
      
      const profileTransaction = this.db.transaction(['profileQueue'], 'readonly');
      const profileStore = profileTransaction.objectStore('profileQueue');
      stats.profile = await profileStore.count();
      
      const chatTransaction = this.db.transaction(['chatQueue'], 'readonly');
      const chatStore = chatTransaction.objectStore('chatQueue');
      stats.chatActions = await chatStore.count();
      
      stats.total = stats.messages + stats.media + stats.profile + stats.chatActions;
      
      return stats;
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return { messages: 0, media: 0, profile: 0, chatActions: 0, total: 0 };
    }
  }

  // Clear all queues (for testing or reset)
  async clearAllQueues() {
    if (!this.db) await this.init();
    
    try {
      const storeNames = ['messageQueue', 'mediaQueue', 'profileQueue', 'chatQueue'];
      
      for (const storeName of storeNames) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        await store.clear();
      }
      
      console.log('All queues cleared');
      this.emit('queues-cleared');
    } catch (error) {
      console.error('Failed to clear queues:', error);
    }
  }

  // Utility functions
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getCurrentUserId() {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      return user?.id || null;
    } catch {
      return null;
    }
  }

  // Get network status
  getNetworkStatus() {
    return {
      online: this.isOnline,
      syncInProgress: this.syncInProgress
    };
  }
}

// Create singleton instance
const offlineQueue = new OfflineQueueService();

export default offlineQueue;
