import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.messageQueue = [];
    this.eventListeners = new Map();
  }

  connect(token) {
    if (this.socket?.connected) {
      return this.socket;
    }

    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
    
    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.setupEventHandlers();
    return this.socket;
  }

  setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('🔌 Connected to server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Process queued messages
      this.processMessageQueue();
      
      // Emit custom connect event
      this.emit('socket_connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from server:', reason);
      this.isConnected = false;
      this.emit('socket_disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 Connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('🔌 Max reconnection attempts reached');
        this.emit('socket_connection_failed');
      }
    });

    // Message events
    this.socket.on('new_message', (data) => {
      console.log('💬 New message received:', data);
      this.emit('new_message', data);
    });

    this.socket.on('message_sent', (data) => {
      console.log('✅ Message sent confirmation:', data);
      this.emit('message_sent', data);
    });

    this.socket.on('message_error', (data) => {
      console.error('❌ Message error:', data);
      this.emit('message_error', data);
    });

    this.socket.on('message_status_update', (data) => {
      console.log('📊 Message status update:', data);
      this.emit('message_status_update', data);
    });

    // Typing events
    this.socket.on('user_typing', (data) => {
      console.log('⌨️ User typing:', data);
      this.emit('user_typing', data);
    });

    this.socket.on('user_stop_typing', (data) => {
      console.log('⌨️ User stopped typing:', data);
      this.emit('user_stop_typing', data);
    });

    // User status events
    this.socket.on('user_online', (data) => {
      console.log('🟢 User online:', data);
      this.emit('user_online', data);
    });

    this.socket.on('user_offline', (data) => {
      console.log('🔴 User offline:', data);
      this.emit('user_offline', data);
    });

    // Chat events
    this.socket.on('chat_created', (data) => {
      console.log('💬 Chat created:', data);
      this.emit('chat_created', data);
    });

    this.socket.on('group_created', (data) => {
      console.log('👥 Group created:', data);
      this.emit('group_created', data);
    });

    this.socket.on('group_updated', (data) => {
      console.log('👥 Group updated:', data);
      this.emit('group_updated', data);
    });

    this.socket.on('participants_added', (data) => {
      console.log('👥 Participants added:', data);
      this.emit('participants_added', data);
    });

    this.socket.on('participant_removed', (data) => {
      console.log('👥 Participant removed:', data);
      this.emit('participant_removed', data);
    });

    // Message reactions
    this.socket.on('message_reaction', (data) => {
      console.log('😀 Message reaction:', data);
      this.emit('message_reaction', data);
    });

    this.socket.on('message_reaction_removed', (data) => {
      console.log('😀 Message reaction removed:', data);
      this.emit('message_reaction_removed', data);
    });

    // Message editing and deletion
    this.socket.on('message_edited', (data) => {
      console.log('✏️ Message edited:', data);
      this.emit('message_edited', data);
    });

    this.socket.on('message_deleted', (data) => {
      console.log('🗑️ Message deleted:', data);
      this.emit('message_deleted', data);
    });

    // Notifications
    this.socket.on('message_notification', (data) => {
      console.log('🔔 Message notification:', data);
      this.emit('message_notification', data);
    });

    // Chat room events
    this.socket.on('joined_chat', (data) => {
      console.log('📨 Joined chat:', data);
      this.emit('joined_chat', data);
    });

    this.socket.on('left_chat', (data) => {
      console.log('📤 Left chat:', data);
      this.emit('left_chat', data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('🔌 Socket error:', error);
      this.emit('socket_error', error);
    });
  }

  // Event listener management
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
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Socket operations
  joinChat(chatId) {
    if (this.isConnected) {
      this.socket.emit('join_chat', { chatId });
    }
  }

  leaveChat(chatId) {
    if (this.isConnected) {
      this.socket.emit('leave_chat', { chatId });
    }
  }

  sendMessage(messageData) {
    if (this.isConnected) {
      this.socket.emit('send_message', messageData);
    } else {
      // Queue message for later sending
      this.messageQueue.push({ type: 'send_message', data: messageData });
    }
  }

  startTyping(chatId) {
    if (this.isConnected) {
      this.socket.emit('typing_start', { chatId });
    }
  }

  stopTyping(chatId) {
    if (this.isConnected) {
      this.socket.emit('typing_stop', { chatId });
    }
  }

  markMessageDelivered(messageId, chatId) {
    if (this.isConnected) {
      this.socket.emit('message_delivered', { messageId, chatId });
    }
  }

  markMessageRead(messageId, chatId) {
    if (this.isConnected) {
      this.socket.emit('message_read', { messageId, chatId });
    }
  }

  addReaction(messageId, emoji, chatId) {
    if (this.isConnected) {
      this.socket.emit('add_reaction', { messageId, emoji, chatId });
    }
  }

  removeReaction(messageId, chatId) {
    if (this.isConnected) {
      this.socket.emit('remove_reaction', { messageId, chatId });
    }
  }

  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const { type, data } = this.messageQueue.shift();
      this.socket.emit(type, data);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
    
    // Clear event listeners
    this.eventListeners.clear();
    this.messageQueue = [];
  }

  // Utility methods
  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }

  getSocket() {
    return this.socket;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
