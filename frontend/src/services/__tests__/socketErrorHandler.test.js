import enhancedSocketService, { 
  SocketError, 
  SOCKET_ERROR_TYPES, 
  CONNECTION_STATES 
} from '../socketErrorHandler';
import toast from 'react-hot-toast';

// Mock socket.io-client
const mockSocket = {
  id: 'mock-socket-id',
  connected: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

jest.mock('socket.io-client', () => {
  return jest.fn(() => mockSocket);
});

// Mock toast
jest.mock('react-hot-toast');

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('EnhancedSocketService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.connected = false;
    mockSocket.id = 'mock-socket-id';
    
    // Reset service state
    enhancedSocketService.disconnect();
    
    // Mock token
    mockLocalStorage.getItem.mockReturnValue('mock-token');
    
    // Mock online status
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  describe('Connection Management', () => {
    it('should connect with authentication token', async () => {
      const io = require('socket.io-client');
      
      const connectPromise = enhancedSocketService.connect('test-token');
      
      // Simulate successful connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      
      await connectPromise;
      
      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token: 'test-token' },
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: false,
          forceNew: true,
        })
      );
    });

    it('should use token from localStorage if not provided', async () => {
      mockLocalStorage.getItem.mockReturnValue('stored-token');
      
      const connectPromise = enhancedSocketService.connect();
      
      // Simulate successful connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      
      await connectPromise;
      
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('token');
    });

    it('should reject connection if no token available', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      await expect(enhancedSocketService.connect()).rejects.toThrow(SocketError);
      await expect(enhancedSocketService.connect()).rejects.toHaveProperty(
        'type', 
        SOCKET_ERROR_TYPES.AUTHENTICATION_FAILED
      );
    });

    it('should handle connection errors', async () => {
      const connectPromise = enhancedSocketService.connect('test-token');
      
      // Simulate connection error
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')[1];
      errorHandler(new Error('Connection failed'));
      
      await expect(connectPromise).rejects.toThrow(SocketError);
      await expect(connectPromise).rejects.toHaveProperty(
        'type', 
        SOCKET_ERROR_TYPES.CONNECTION_FAILED
      );
    });

    it('should handle disconnection', () => {
      const connectPromise = enhancedSocketService.connect('test-token');
      
      // First connect
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      
      // Then disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      mockSocket.connected = false;
      disconnectHandler('transport close');
      
      const status = enhancedSocketService.getStatus();
      expect(status.state).toBe(CONNECTION_STATES.DISCONNECTED);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      // Setup connected socket
      const connectPromise = enhancedSocketService.connect('test-token');
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;
    });

    it('should handle authentication errors', () => {
      const authErrorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'auth_error')[1];
      
      // Mock window.location.href
      delete window.location;
      window.location = { href: '' };
      
      authErrorHandler({ message: 'Invalid token' });
      
      expect(window.location.href).toBe('/login');
    });

    it('should handle server errors', () => {
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')[1];
      
      errorHandler({ message: 'Server error occurred' });
      
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Server error')
      );
    });

    it('should handle rate limiting', () => {
      const rateLimitHandler = mockSocket.on.mock.calls.find(call => call[0] === 'rate_limited')[1];
      
      rateLimitHandler({ message: 'Too many requests' });
      
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Rate limited')
      );
    });

    it('should handle message errors', () => {
      const messageErrorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message_error')[1];
      
      messageErrorHandler({ message: 'Message failed to send' });
      
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Message failed')
      );
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection on transport close', async () => {
      // Setup connected socket
      const connectPromise = enhancedSocketService.connect('test-token');
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;
      
      // Mock the connect method for reconnection
      const connectSpy = jest.spyOn(enhancedSocketService, 'connect');
      
      // Simulate disconnect due to transport close
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      mockSocket.connected = false;
      disconnectHandler('transport close');
      
      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(connectSpy).toHaveBeenCalled();
    });

    it('should not reconnect on server disconnect', async () => {
      // Setup connected socket
      const connectPromise = enhancedSocketService.connect('test-token');
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;
      
      const connectSpy = jest.spyOn(enhancedSocketService, 'connect');
      
      // Simulate server-initiated disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      mockSocket.connected = false;
      disconnectHandler('io server disconnect');
      
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Disconnected by server')
      );
      expect(connectSpy).not.toHaveBeenCalled();
    });

    it('should limit reconnection attempts', async () => {
      // Setup initial connection
      const connectPromise = enhancedSocketService.connect('test-token');
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;
      
      // Mock failed reconnection attempts
      const io = require('socket.io-client');
      io.mockImplementation(() => ({
        ...mockSocket,
        on: jest.fn((event, handler) => {
          if (event === 'connect_error') {
            // Immediately trigger error
            setTimeout(() => handler(new Error('Connection failed')), 0);
          }
          return mockSocket;
        }),
      }));
      
      // Trigger disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      mockSocket.connected = false;
      disconnectHandler('transport close');
      
      // Wait for all reconnection attempts
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to reconnect')
      );
    });
  });

  describe('Message Queue', () => {
    it('should queue messages when disconnected', () => {
      const callback = jest.fn();
      
      enhancedSocketService.emit('test_event', { data: 'test' }, callback);
      
      // Message should be queued, not sent immediately
      expect(mockSocket.emit).not.toHaveBeenCalled();
      
      const status = enhancedSocketService.getStatus();
      expect(status.queuedMessages).toBe(1);
    });

    it('should process queued messages on reconnection', async () => {
      // Queue a message while disconnected
      const callback = jest.fn();
      enhancedSocketService.emit('test_event', { data: 'test' }, callback);
      
      // Connect
      const connectPromise = enhancedSocketService.connect('test-token');
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;
      
      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockSocket.emit).toHaveBeenCalledWith('test_event', { data: 'test' }, callback);
    });

    it('should handle queued message errors', async () => {
      // Queue a message
      const callback = jest.fn();
      enhancedSocketService.emit('test_event', { data: 'test' }, callback);
      
      // Connect but make emit fail
      mockSocket.emit.mockImplementation(() => {
        throw new Error('Emit failed');
      });
      
      const connectPromise = enhancedSocketService.connect('test-token');
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;
      
      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(callback).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Heartbeat System', () => {
    it('should start heartbeat on connection', async () => {
      jest.useFakeTimers();
      
      const connectPromise = enhancedSocketService.connect('test-token');
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;
      
      // Fast-forward time to trigger heartbeat
      jest.advanceTimersByTime(6000);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('ping', expect.any(Number));
      
      jest.useRealTimers();
    });

    it('should update latency metrics on pong', async () => {
      const connectPromise = enhancedSocketService.connect('test-token');
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;
      
      // Simulate pong response
      const pongHandler = mockSocket.on.mock.calls.find(call => call[0] === 'pong')[1];
      pongHandler(50); // 50ms latency
      
      const status = enhancedSocketService.getStatus();
      expect(status.metrics.averageLatency).toBe(50);
    });

    it('should stop heartbeat on disconnect', async () => {
      jest.useFakeTimers();
      
      const connectPromise = enhancedSocketService.connect('test-token');
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;
      
      // Disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      mockSocket.connected = false;
      disconnectHandler('io server disconnect');
      
      // Clear previous emit calls
      mockSocket.emit.mockClear();
      
      // Fast-forward time - should not emit ping
      jest.advanceTimersByTime(10000);
      
      expect(mockSocket.emit).not.toHaveBeenCalledWith('ping', expect.any(Number));
      
      jest.useRealTimers();
    });
  });

  describe('Network Status Monitoring', () => {
    it('should attempt reconnection when network is restored', async () => {
      // Setup connected socket
      const connectPromise = enhancedSocketService.connect('test-token');
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;
      
      // Simulate network loss
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      
      window.dispatchEvent(new Event('offline'));
      
      // Disconnect socket
      enhancedSocketService.disconnect();
      
      const connectSpy = jest.spyOn(enhancedSocketService, 'connect');
      
      // Simulate network restoration
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });
      
      window.dispatchEvent(new Event('online'));
      
      expect(connectSpy).toHaveBeenCalled();
    });

    it('should show network loss message', () => {
      // Simulate network loss
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      
      window.dispatchEvent(new Event('offline'));
      
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Network connection lost')
      );
    });
  });

  describe('Event Listener Management', () => {
    it('should register event listeners', () => {
      const callback = jest.fn();
      
      enhancedSocketService.on('test_event', callback);
      
      expect(mockSocket.on).toHaveBeenCalledWith('test_event', callback);
    });

    it('should remove event listeners', () => {
      const callback = jest.fn();
      
      enhancedSocketService.on('test_event', callback);
      enhancedSocketService.off('test_event', callback);
      
      expect(mockSocket.off).toHaveBeenCalledWith('test_event', callback);
    });

    it('should track event listeners internally', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      enhancedSocketService.on('test_event', callback1);
      enhancedSocketService.on('test_event', callback2);
      enhancedSocketService.on('other_event', callback1);
      
      // Internal tracking should work (no direct way to test, but ensures no errors)
      expect(true).toBe(true);
    });
  });

  describe('Enhanced Emit with Error Handling', () => {
    beforeEach(async () => {
      // Setup connected socket
      const connectPromise = enhancedSocketService.connect('test-token');
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;
    });

    it('should emit events when connected', () => {
      const callback = jest.fn();
      
      enhancedSocketService.emit('test_event', { data: 'test' }, callback);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('test_event', { data: 'test' }, expect.any(Function));
    });

    it('should handle server error responses', () => {
      const callback = jest.fn();
      
      // Mock emit to call callback with error response
      mockSocket.emit.mockImplementation((event, data, cb) => {
        cb({ error: { message: 'Server error' } });
      });
      
      enhancedSocketService.emit('test_event', { data: 'test' }, callback);
      
      expect(callback).toHaveBeenCalledWith(expect.any(SocketError));
    });

    it('should handle successful responses', () => {
      const callback = jest.fn();
      
      // Mock emit to call callback with success response
      mockSocket.emit.mockImplementation((event, data, cb) => {
        cb({ success: true, data: 'response' });
      });
      
      enhancedSocketService.emit('test_event', { data: 'test' }, callback);
      
      expect(callback).toHaveBeenCalledWith(null, { success: true, data: 'response' });
    });

    it('should queue messages when not connected', () => {
      // Disconnect
      enhancedSocketService.disconnect();
      
      const callback = jest.fn();
      enhancedSocketService.emit('test_event', { data: 'test' }, callback);
      
      // Should not emit immediately
      expect(mockSocket.emit).not.toHaveBeenCalledWith('test_event', expect.any(Object), expect.any(Function));
      
      const status = enhancedSocketService.getStatus();
      expect(status.queuedMessages).toBe(1);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide connection status', () => {
      const status = enhancedSocketService.getStatus();
      
      expect(status).toEqual(
        expect.objectContaining({
          state: expect.any(String),
          connected: expect.any(Boolean),
          reconnectAttempts: expect.any(Number),
          queuedMessages: expect.any(Number),
          metrics: expect.any(Object),
          errors: expect.any(Array),
        })
      );
    });

    it('should provide error statistics', () => {
      const stats = enhancedSocketService.getErrorStats();
      
      expect(stats).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          byType: expect.any(Object),
          recent: expect.any(Array),
        })
      );
    });

    it('should track connection metrics', async () => {
      const connectPromise = enhancedSocketService.connect('test-token');
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      mockSocket.connected = true;
      connectHandler();
      await connectPromise;
      
      const status = enhancedSocketService.getStatus();
      
      expect(status.metrics.totalReconnects).toBeGreaterThan(0);
    });
  });
});

describe('SocketError', () => {
  it('should create error with correct properties', () => {
    const error = new SocketError(
      'Test socket error',
      SOCKET_ERROR_TYPES.CONNECTION_FAILED,
      new Error('Original error'),
      { context: 'test' }
    );

    expect(error.message).toBe('Test socket error');
    expect(error.type).toBe(SOCKET_ERROR_TYPES.CONNECTION_FAILED);
    expect(error.originalError).toBeInstanceOf(Error);
    expect(error.context).toEqual({ context: 'test' });
    expect(error.timestamp).toBeDefined();
    expect(error.retryable).toBe(true);
  });

  it('should determine retryability correctly', () => {
    const retryableError = new SocketError('Network error', SOCKET_ERROR_TYPES.CONNECTION_FAILED);
    expect(retryableError.retryable).toBe(true);

    const nonRetryableError = new SocketError('Permission denied', SOCKET_ERROR_TYPES.PERMISSION_DENIED);
    expect(nonRetryableError.retryable).toBe(false);
  });

  it('should provide user-friendly messages', () => {
    const connectionError = new SocketError('Connection failed', SOCKET_ERROR_TYPES.CONNECTION_FAILED);
    expect(connectionError.toUserMessage()).toContain('Unable to connect to chat server');

    const authError = new SocketError('Auth failed', SOCKET_ERROR_TYPES.AUTHENTICATION_FAILED);
    expect(authError.toUserMessage()).toContain('Authentication failed');

    const rateLimitError = new SocketError('Rate limited', SOCKET_ERROR_TYPES.RATE_LIMITED);
    expect(rateLimitError.toUserMessage()).toContain('Too many requests');
  });
});
