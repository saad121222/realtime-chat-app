import io from 'socket.io-client';
import toast from 'react-hot-toast';

// Socket error types
export const SOCKET_ERROR_TYPES = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  DISCONNECTED: 'DISCONNECTED',
  RECONNECTION_FAILED: 'RECONNECTION_FAILED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'SERVER_ERROR',
  INVALID_DATA: 'INVALID_DATA',
  ROOM_ERROR: 'ROOM_ERROR',
  MESSAGE_FAILED: 'MESSAGE_FAILED'
};

// Connection states
export const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed'
};

class SocketError extends Error {
  constructor(message, type, originalError = null, context = {}) {
    super(message);
    this.name = 'SocketError';
    this.type = type;
    this.originalError = originalError;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.retryable = this.isRetryable();
  }

  isRetryable() {
    const retryableTypes = [
      SOCKET_ERROR_TYPES.CONNECTION_FAILED,
      SOCKET_ERROR_TYPES.CONNECTION_TIMEOUT,
      SOCKET_ERROR_TYPES.DISCONNECTED,
      SOCKET_ERROR_TYPES.SERVER_ERROR
    ];
    
    return retryableTypes.includes(this.type);
  }

  toUserMessage() {
    const userMessages = {
      [SOCKET_ERROR_TYPES.CONNECTION_FAILED]: 'Unable to connect to chat server. Please check your internet connection.',
      [SOCKET_ERROR_TYPES.CONNECTION_TIMEOUT]: 'Connection timed out. Please try again.',
      [SOCKET_ERROR_TYPES.DISCONNECTED]: 'Connection lost. Attempting to reconnect...',
      [SOCKET_ERROR_TYPES.RECONNECTION_FAILED]: 'Failed to reconnect. Please refresh the page.',
      [SOCKET_ERROR_TYPES.AUTHENTICATION_FAILED]: 'Authentication failed. Please log in again.',
      [SOCKET_ERROR_TYPES.PERMISSION_DENIED]: 'Permission denied for this action.',
      [SOCKET_ERROR_TYPES.RATE_LIMITED]: 'Too many requests. Please slow down.',
      [SOCKET_ERROR_TYPES.SERVER_ERROR]: 'Server error occurred. Please try again.',
      [SOCKET_ERROR_TYPES.INVALID_DATA]: 'Invalid data sent. Please try again.',
      [SOCKET_ERROR_TYPES.ROOM_ERROR]: 'Failed to join chat room.',
      [SOCKET_ERROR_TYPES.MESSAGE_FAILED]: 'Failed to send message. Please try again.'
    };

    return userMessages[this.type] || this.message;
  }
}

class EnhancedSocketService {
  constructor() {
    this.socket = null;
    this.connectionState = CONNECTION_STATES.DISCONNECTED;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.heartbeatInterval = null;
    this.heartbeatTimeout = 5000;
    
    // Error tracking
    this.errorLog = [];
    this.maxErrorLogSize = 50;
    
    // Event listeners
    this.eventListeners = new Map();
    
    // Message queue for offline scenarios
    this.messageQueue = [];
    this.isProcessingQueue = false;
    
    // Connection monitoring
    this.connectionMetrics = {
      connectTime: null,
      disconnectTime: null,
      totalDisconnects: 0,
      totalReconnects: 0,
      averageLatency: 0,
      latencyHistory: []
    };

    // Network status
    this.isOnline = navigator.onLine;
    this.setupNetworkMonitoring();
  }

  setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Network restored, attempting socket reconnection');
      if (this.connectionState === CONNECTION_STATES.DISCONNECTED) {
        this.connect();
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📵 Network lost');
      this.handleNetworkDisconnection();
    });
  }

  connect(token = null) {
    if (this.socket && this.socket.connected) {
      console.log('Socket already connected');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.connectionState = CONNECTION_STATES.CONNECTING;
        this.connectionMetrics.connectTime = Date.now();

        const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
        const authToken = token || localStorage.getItem('token');

        if (!authToken) {
          const error = new SocketError(
            'No authentication token available',
            SOCKET_ERROR_TYPES.AUTHENTICATION_FAILED
          );
          this.handleError(error);
          reject(error);
          return;
        }

        // Socket.IO configuration
        const socketOptions = {
          auth: { token: authToken },
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: false, // We'll handle reconnection manually
          forceNew: true
        };

        this.socket = io(socketUrl, socketOptions);
        this.setupEventHandlers(resolve, reject);
        
      } catch (error) {
        const socketError = new SocketError(
          'Failed to initialize socket connection',
          SOCKET_ERROR_TYPES.CONNECTION_FAILED,
          error
        );
        this.handleError(socketError);
        reject(socketError);
      }
    });
  }

  setupEventHandlers(connectResolve, connectReject) {
    // Connection successful
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
      this.connectionState = CONNECTION_STATES.CONNECTED;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      
      // Update metrics
      this.connectionMetrics.totalReconnects++;
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Process queued messages
      this.processMessageQueue();
      
      // Show success message
      if (this.connectionMetrics.totalReconnects > 1) {
        toast.success('Reconnected to chat server');
      }
      
      connectResolve();
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      
      const socketError = new SocketError(
        `Connection failed: ${error.message}`,
        SOCKET_ERROR_TYPES.CONNECTION_FAILED,
        error,
        { attempt: this.reconnectAttempts + 1 }
      );
      
      this.handleError(socketError);
      this.handleConnectionFailure();
      connectReject(socketError);
    });

    // Disconnection
    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ Socket disconnected:', reason);
      this.connectionState = CONNECTION_STATES.DISCONNECTED;
      this.connectionMetrics.disconnectTime = Date.now();
      this.connectionMetrics.totalDisconnects++;
      
      // Stop heartbeat
      this.stopHeartbeat();
      
      const socketError = new SocketError(
        `Disconnected: ${reason}`,
        SOCKET_ERROR_TYPES.DISCONNECTED,
        null,
        { reason }
      );
      
      this.handleError(socketError);
      
      // Handle different disconnect reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect - don't reconnect automatically
        toast.error('Disconnected by server. Please refresh the page.');
      } else if (reason === 'transport close' || reason === 'ping timeout') {
        // Network issues - attempt reconnection
        this.attemptReconnection();
      }
    });

    // Authentication error
    this.socket.on('auth_error', (error) => {
      console.error('🔐 Authentication error:', error);
      
      const socketError = new SocketError(
        'Authentication failed',
        SOCKET_ERROR_TYPES.AUTHENTICATION_FAILED,
        error
      );
      
      this.handleError(socketError);
      this.disconnect();
      
      // Redirect to login
      window.location.href = '/login';
    });

    // Server errors
    this.socket.on('error', (error) => {
      console.error('🚨 Socket server error:', error);
      
      const socketError = new SocketError(
        `Server error: ${error.message || error}`,
        SOCKET_ERROR_TYPES.SERVER_ERROR,
        error
      );
      
      this.handleError(socketError);
    });

    // Rate limiting
    this.socket.on('rate_limited', (data) => {
      console.warn('⏱️ Rate limited:', data);
      
      const socketError = new SocketError(
        `Rate limited: ${data.message}`,
        SOCKET_ERROR_TYPES.RATE_LIMITED,
        null,
        data
      );
      
      this.handleError(socketError);
    });

    // Heartbeat response
    this.socket.on('pong', (latency) => {
      this.updateLatencyMetrics(latency);
    });

    // Message acknowledgment errors
    this.socket.on('message_error', (error) => {
      console.error('💬 Message error:', error);
      
      const socketError = new SocketError(
        `Message failed: ${error.message}`,
        SOCKET_ERROR_TYPES.MESSAGE_FAILED,
        error
      );
      
      this.handleError(socketError);
    });
  }

  handleError(error) {
    // Add to error log
    this.errorLog.push(error);
    
    // Trim log if too large
    if (this.errorLog.length > this.maxErrorLogSize) {
      this.errorLog.splice(0, this.errorLog.length - this.maxErrorLogSize);
    }

    // Log to console
    console.error('Socket Error:', error);

    // Send to error monitoring
    this.sendErrorToMonitoring(error);

    // Show user-friendly message
    this.showErrorToUser(error);

    // Emit error event for components to handle
    this.emit('socket_error', error);
  }

  showErrorToUser(error) {
    // Don't show certain errors to user
    const silentErrors = [
      SOCKET_ERROR_TYPES.RATE_LIMITED,
      SOCKET_ERROR_TYPES.INVALID_DATA
    ];

    if (silentErrors.includes(error.type)) {
      return;
    }

    const message = error.toUserMessage();
    
    // Show different toast types based on error severity
    if (error.type === SOCKET_ERROR_TYPES.AUTHENTICATION_FAILED) {
      toast.error(message, { duration: 6000 });
    } else if (error.type === SOCKET_ERROR_TYPES.DISCONNECTED) {
      toast.loading(message, { id: 'socket-disconnected' });
    } else {
      toast.error(message);
    }
  }

  sendErrorToMonitoring(error) {
    if (process.env.NODE_ENV === 'production') {
      // Send to external monitoring service
      if (window.Sentry) {
        window.Sentry.captureException(error.originalError || error, {
          tags: {
            errorType: error.type,
            component: 'socket'
          },
          extra: {
            ...error.context,
            connectionState: this.connectionState,
            reconnectAttempts: this.reconnectAttempts
          }
        });
      }

      // Send to internal monitoring
      fetch('/api/monitoring/socket-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            type: error.type,
            message: error.message,
            context: error.context,
            timestamp: error.timestamp
          },
          metrics: this.connectionMetrics,
          userAgent: navigator.userAgent
        })
      }).catch(console.error);
    }
  }

  handleConnectionFailure() {
    this.connectionState = CONNECTION_STATES.FAILED;
    
    if (this.isOnline) {
      this.attemptReconnection();
    } else {
      console.log('📵 Offline - will reconnect when network is restored');
    }
  }

  handleNetworkDisconnection() {
    if (this.socket) {
      this.socket.disconnect();
    }
    toast.dismiss('socket-disconnected');
    toast.error('Network connection lost');
  }

  async attemptReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.connectionState = CONNECTION_STATES.FAILED;
      toast.error('Failed to reconnect. Please refresh the page.');
      return;
    }

    if (!this.isOnline) {
      console.log('📵 Offline - skipping reconnection attempt');
      return;
    }

    this.connectionState = CONNECTION_STATES.RECONNECTING;
    this.reconnectAttempts++;

    console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    // Show reconnecting message
    toast.loading(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, {
      id: 'socket-reconnecting'
    });

    // Wait before reconnecting (exponential backoff)
    await this.sleep(this.reconnectDelay);
    
    try {
      await this.connect();
      toast.dismiss('socket-reconnecting');
      toast.success('Reconnected successfully');
    } catch (error) {
      console.error('Reconnection failed:', error);
      
      // Increase delay for next attempt (exponential backoff)
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      
      // Try again
      setTimeout(() => this.attemptReconnection(), 1000);
    }
  }

  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing heartbeat
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        const startTime = Date.now();
        this.socket.emit('ping', startTime);
      }
    }, this.heartbeatTimeout);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  updateLatencyMetrics(latency) {
    this.connectionMetrics.latencyHistory.push(latency);
    
    // Keep only last 10 latency measurements
    if (this.connectionMetrics.latencyHistory.length > 10) {
      this.connectionMetrics.latencyHistory.shift();
    }
    
    // Calculate average latency
    this.connectionMetrics.averageLatency = 
      this.connectionMetrics.latencyHistory.reduce((sum, l) => sum + l, 0) / 
      this.connectionMetrics.latencyHistory.length;
  }

  // Message queue management
  queueMessage(event, data, callback) {
    this.messageQueue.push({
      event,
      data,
      callback,
      timestamp: Date.now()
    });

    // Process queue if connected
    if (this.connectionState === CONNECTION_STATES.CONNECTED) {
      this.processMessageQueue();
    }
  }

  async processMessageQueue() {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(`📤 Processing ${this.messageQueue.length} queued messages`);

    while (this.messageQueue.length > 0) {
      const queuedMessage = this.messageQueue.shift();
      
      try {
        if (this.socket && this.socket.connected) {
          this.socket.emit(queuedMessage.event, queuedMessage.data, queuedMessage.callback);
        } else {
          // Re-queue if not connected
          this.messageQueue.unshift(queuedMessage);
          break;
        }
      } catch (error) {
        console.error('Failed to send queued message:', error);
        queuedMessage.callback?.(error);
      }
    }

    this.isProcessingQueue = false;
  }

  // Enhanced emit with error handling
  emit(event, data, callback) {
    if (!this.socket || !this.socket.connected) {
      if (this.connectionState === CONNECTION_STATES.CONNECTING || 
          this.connectionState === CONNECTION_STATES.RECONNECTING) {
        // Queue message if connecting
        this.queueMessage(event, data, callback);
        return;
      }
      
      const error = new SocketError(
        'Socket not connected',
        SOCKET_ERROR_TYPES.DISCONNECTED
      );
      
      callback?.(error);
      return;
    }

    try {
      this.socket.emit(event, data, (response) => {
        if (response && response.error) {
          const error = new SocketError(
            response.error.message || 'Server error',
            SOCKET_ERROR_TYPES.SERVER_ERROR,
            response.error
          );
          this.handleError(error);
          callback?.(error);
        } else {
          callback?.(null, response);
        }
      });
    } catch (error) {
      const socketError = new SocketError(
        'Failed to emit event',
        SOCKET_ERROR_TYPES.INVALID_DATA,
        error,
        { event, data }
      );
      
      this.handleError(socketError);
      callback?.(socketError);
    }
  }

  // Enhanced event listener management
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event).add(callback);
    
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
    
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Utility methods
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  disconnect() {
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connectionState = CONNECTION_STATES.DISCONNECTED;
    this.messageQueue = [];
    toast.dismiss('socket-disconnected');
    toast.dismiss('socket-reconnecting');
  }

  // Get connection status and metrics
  getStatus() {
    return {
      state: this.connectionState,
      connected: this.socket?.connected || false,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      metrics: this.connectionMetrics,
      errors: this.errorLog.slice(-5) // Last 5 errors
    };
  }

  // Get error statistics
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byType: {},
      recent: this.errorLog.slice(-10)
    };

    this.errorLog.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
    });

    return stats;
  }
}

// Create singleton instance
const enhancedSocketService = new EnhancedSocketService();

export default enhancedSocketService;
export { SocketError, SOCKET_ERROR_TYPES, CONNECTION_STATES };
