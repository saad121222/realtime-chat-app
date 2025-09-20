class NotificationService {
  constructor() {
    this.permission = 'default';
    this.isSupported = 'Notification' in window;
    this.isServiceWorkerSupported = 'serviceWorker' in navigator;
    this.registration = null;
    this.sounds = {};
    this.settings = this.loadSettings();
    this.doNotDisturb = false;
    this.activeNotifications = new Map();
    
    this.init();
  }

  async init() {
    // Check current permission
    if (this.isSupported) {
      this.permission = Notification.permission;
    }

    // Register service worker for push notifications
    if (this.isServiceWorkerSupported) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered successfully');
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }

    // Load notification sounds
    this.loadSounds();

    // Load settings from localStorage
    this.loadSettingsFromStorage();

    // Set up visibility change listener
    this.setupVisibilityListener();
  }

  loadSounds() {
    const soundFiles = {
      message: '/sounds/message.mp3',
      mention: '/sounds/mention.mp3',
      call: '/sounds/call.mp3',
      notification: '/sounds/notification.mp3'
    };

    Object.entries(soundFiles).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.volume = this.settings.soundVolume || 0.7;
      this.sounds[key] = audio;
    });
  }

  loadSettingsFromStorage() {
    const stored = localStorage.getItem('notificationSettings');
    if (stored) {
      this.settings = { ...this.settings, ...JSON.parse(stored) };
    }

    const dndStored = localStorage.getItem('doNotDisturb');
    if (dndStored) {
      this.doNotDisturb = JSON.parse(dndStored);
    }
  }

  loadSettings() {
    return {
      enabled: true,
      sound: true,
      soundVolume: 0.7,
      desktop: true,
      preview: true,
      vibrate: true,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      },
      chatSettings: {} // Per-chat notification settings
    };
  }

  saveSettings() {
    localStorage.setItem('notificationSettings', JSON.stringify(this.settings));
    localStorage.setItem('doNotDisturb', JSON.stringify(this.doNotDisturb));
  }

  setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Clear notifications when user returns to app
        this.clearAllNotifications();
      }
    });
  }

  // Permission Management
  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Notifications not supported');
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  hasPermission() {
    return this.permission === 'granted';
  }

  // Settings Management
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    
    // Update sound volumes
    Object.values(this.sounds).forEach(audio => {
      audio.volume = this.settings.soundVolume || 0.7;
    });
  }

  getChatSettings(chatId) {
    return this.settings.chatSettings[chatId] || {
      enabled: true,
      sound: true,
      preview: true,
      priority: 'normal' // normal, high, muted
    };
  }

  updateChatSettings(chatId, settings) {
    this.settings.chatSettings[chatId] = {
      ...this.getChatSettings(chatId),
      ...settings
    };
    this.saveSettings();
  }

  // Do Not Disturb
  setDoNotDisturb(enabled, duration = null) {
    this.doNotDisturb = enabled;
    
    if (enabled && duration) {
      // Auto-disable after duration (in minutes)
      setTimeout(() => {
        this.doNotDisturb = false;
        this.saveSettings();
      }, duration * 60 * 1000);
    }
    
    this.saveSettings();
  }

  isDoNotDisturb() {
    // Check DND mode
    if (this.doNotDisturb) return true;

    // Check quiet hours
    if (this.settings.quietHours.enabled) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const [startHour, startMin] = this.settings.quietHours.start.split(':').map(Number);
      const [endHour, endMin] = this.settings.quietHours.end.split(':').map(Number);
      
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;
      
      if (startTime > endTime) {
        // Crosses midnight
        return currentTime >= startTime || currentTime <= endTime;
      } else {
        return currentTime >= startTime && currentTime <= endTime;
      }
    }

    return false;
  }

  // Sound Management
  async playSound(type = 'message', chatId = null) {
    if (!this.settings.sound) return;
    if (this.isDoNotDisturb()) return;

    const chatSettings = chatId ? this.getChatSettings(chatId) : { sound: true };
    if (!chatSettings.sound) return;

    const sound = this.sounds[type] || this.sounds.message;
    
    try {
      sound.currentTime = 0;
      await sound.play();
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }

  // Vibration
  vibrate(pattern = [200, 100, 200]) {
    if (!this.settings.vibrate) return;
    if (this.isDoNotDisturb()) return;
    if (!navigator.vibrate) return;

    navigator.vibrate(pattern);
  }

  // Browser Notifications
  async showNotification(options) {
    const {
      title,
      body,
      icon,
      image,
      tag,
      chatId,
      messageId,
      data = {},
      actions = [],
      requireInteraction = false
    } = options;

    // Check if notifications are enabled
    if (!this.settings.enabled || !this.settings.desktop) return;
    if (this.isDoNotDisturb()) return;
    if (!this.hasPermission()) return;

    // Check chat-specific settings
    const chatSettings = chatId ? this.getChatSettings(chatId) : { enabled: true, preview: true };
    if (!chatSettings.enabled) return;

    // Check if app is visible (don't show notifications if user is actively using the app)
    if (document.visibilityState === 'visible' && document.hasFocus()) return;

    const notificationOptions = {
      body: chatSettings.preview ? body : 'New message',
      icon: icon || '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: tag || `chat-${chatId}`,
      data: {
        chatId,
        messageId,
        timestamp: Date.now(),
        ...data
      },
      requireInteraction,
      silent: !this.settings.sound,
      actions: actions.length > 0 ? actions : [
        {
          action: 'reply',
          title: 'Reply',
          icon: '/icons/reply.png'
        },
        {
          action: 'mark-read',
          title: 'Mark as Read',
          icon: '/icons/check.png'
        }
      ]
    };

    if (image) {
      notificationOptions.image = image;
    }

    try {
      let notification;
      
      if (this.registration && this.registration.showNotification) {
        // Use service worker for persistent notifications
        await this.registration.showNotification(title, notificationOptions);
      } else {
        // Fallback to regular notifications
        notification = new Notification(title, notificationOptions);
        
        // Store notification reference
        if (tag) {
          this.activeNotifications.set(tag, notification);
        }

        // Auto-close after 5 seconds if not persistent
        if (!requireInteraction) {
          setTimeout(() => {
            notification.close();
            if (tag) {
              this.activeNotifications.delete(tag);
            }
          }, 5000);
        }

        // Handle click events
        notification.onclick = (event) => {
          event.preventDefault();
          window.focus();
          
          // Navigate to chat if chatId provided
          if (chatId) {
            window.postMessage({
              type: 'NOTIFICATION_CLICK',
              chatId,
              messageId
            }, '*');
          }
          
          notification.close();
          if (tag) {
            this.activeNotifications.delete(tag);
          }
        };
      }

      // Play sound
      await this.playSound('message', chatId);
      
      // Vibrate
      this.vibrate();

    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  // Message Notifications
  async notifyNewMessage(message, chat, sender) {
    const isGroupChat = chat.chatType === 'group';
    const senderName = sender.name || 'Unknown';
    const chatName = chat.name || senderName;

    let title, body, icon;

    if (isGroupChat) {
      title = chatName;
      body = `${senderName}: ${this.getMessagePreview(message)}`;
    } else {
      title = senderName;
      body = this.getMessagePreview(message);
    }

    icon = sender.avatar || chat.avatar || '/icons/default-avatar.png';

    await this.showNotification({
      title,
      body,
      icon,
      tag: `message-${chat._id}`,
      chatId: chat._id,
      messageId: message._id,
      data: {
        type: 'message',
        senderId: sender._id,
        senderName
      }
    });
  }

  // Mention Notifications
  async notifyMention(message, chat, sender, mentionedUsers) {
    const senderName = sender.name || 'Unknown';
    const chatName = chat.name || senderName;

    await this.showNotification({
      title: `${senderName} mentioned you in ${chatName}`,
      body: this.getMessagePreview(message),
      icon: sender.avatar || '/icons/default-avatar.png',
      tag: `mention-${chat._id}-${message._id}`,
      chatId: chat._id,
      messageId: message._id,
      requireInteraction: true,
      data: {
        type: 'mention',
        senderId: sender._id,
        senderName,
        mentionedUsers
      }
    });

    // Play special mention sound
    await this.playSound('mention', chat._id);
  }

  // Call Notifications
  async notifyCall(caller, callType = 'voice') {
    const callerName = caller.name || 'Unknown';
    
    await this.showNotification({
      title: `Incoming ${callType} call`,
      body: `${callerName} is calling you`,
      icon: caller.avatar || '/icons/default-avatar.png',
      tag: `call-${caller._id}`,
      requireInteraction: true,
      actions: [
        {
          action: 'answer',
          title: 'Answer',
          icon: '/icons/phone-answer.png'
        },
        {
          action: 'decline',
          title: 'Decline',
          icon: '/icons/phone-decline.png'
        }
      ],
      data: {
        type: 'call',
        callerId: caller._id,
        callerName,
        callType
      }
    });

    // Play call sound
    await this.playSound('call');
  }

  getMessagePreview(message) {
    switch (message.messageType) {
      case 'text':
        return message.content || 'Message';
      case 'image':
        return '📷 Photo';
      case 'video':
        return '🎥 Video';
      case 'audio':
        return '🎵 Audio';
      case 'document':
        return '📄 Document';
      case 'location':
        return '📍 Location';
      case 'contact':
        return '👤 Contact';
      default:
        return 'New message';
    }
  }

  // Badge Management
  updateBadge(count) {
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        navigator.setAppBadge(count);
      } else {
        navigator.clearAppBadge();
      }
    }

    // Update favicon badge
    this.updateFaviconBadge(count);
    
    // Update document title
    this.updateDocumentTitle(count);
  }

  updateFaviconBadge(count) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // Draw base favicon
    const favicon = new Image();
    favicon.onload = () => {
      ctx.drawImage(favicon, 0, 0, 32, 32);

      if (count > 0) {
        // Draw badge
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(24, 8, 8, 0, 2 * Math.PI);
        ctx.fill();

        // Draw count
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(count > 99 ? '99+' : count.toString(), 24, 8);
      }

      // Update favicon
      const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = canvas.toDataURL();
      document.getElementsByTagName('head')[0].appendChild(link);
    };
    favicon.src = '/favicon.ico';
  }

  updateDocumentTitle(count) {
    const baseTitle = 'WhatsApp Clone';
    if (count > 0) {
      document.title = `(${count}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }

  // Notification Management
  clearNotification(tag) {
    const notification = this.activeNotifications.get(tag);
    if (notification) {
      notification.close();
      this.activeNotifications.delete(tag);
    }
  }

  clearChatNotifications(chatId) {
    const tag = `message-${chatId}`;
    this.clearNotification(tag);
  }

  clearAllNotifications() {
    // Close all active notifications
    this.activeNotifications.forEach((notification, tag) => {
      notification.close();
    });
    this.activeNotifications.clear();

    // Clear service worker notifications
    if (this.registration && this.registration.getNotifications) {
      this.registration.getNotifications().then(notifications => {
        notifications.forEach(notification => notification.close());
      });
    }
  }

  // Test Notification
  async testNotification() {
    if (!this.hasPermission()) {
      const granted = await this.requestPermission();
      if (!granted) return false;
    }

    await this.showNotification({
      title: 'Test Notification',
      body: 'This is a test notification from WhatsApp Clone',
      icon: '/icons/icon-192x192.png',
      tag: 'test-notification'
    });

    return true;
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;
