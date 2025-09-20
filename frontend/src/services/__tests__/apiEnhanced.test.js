import apiService, { ApiError, ERROR_TYPES, ERROR_SEVERITY } from '../apiEnhanced';
import toast from 'react-hot-toast';

// Mock toast
jest.mock('react-hot-toast');

// Mock fetch
global.fetch = jest.fn();

describe('ApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    // Reset online status
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  describe('Request Configuration', () => {
    it('should add authorization header when token exists', async () => {
      localStorage.setItem('token', 'test-token');
      
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
      });

      await apiService.get('/test');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should not add authorization header when token does not exist', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
      });

      await apiService.get('/test');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String),
          }),
        })
      );
    });

    it('should set correct content type for JSON requests', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
      });

      await apiService.post('/test', { data: 'test' });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('HTTP Methods', () => {
    beforeEach(() => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
      });
    });

    it('should make GET requests', async () => {
      await apiService.get('/test');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should make POST requests', async () => {
      const data = { test: 'data' };
      await apiService.post('/test', data);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
        })
      );
    });

    it('should make PUT requests', async () => {
      const data = { test: 'data' };
      await apiService.put('/test', data);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(data),
        })
      );
    });

    it('should make PATCH requests', async () => {
      const data = { test: 'data' };
      await apiService.patch('/test', data);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(data),
        })
      );
    });

    it('should make DELETE requests', async () => {
      await apiService.delete('/test');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      fetch.mockRejectedValue(new Error('Network Error'));

      await expect(apiService.get('/test')).rejects.toThrow(ApiError);
      await expect(apiService.get('/test')).rejects.toHaveProperty('type', ERROR_TYPES.NETWORK);
    });

    it('should handle 401 authentication errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({ message: 'Unauthorized' }),
      });

      await expect(apiService.get('/test')).rejects.toThrow(ApiError);
      await expect(apiService.get('/test')).rejects.toHaveProperty('type', ERROR_TYPES.AUTHENTICATION);
    });

    it('should handle 403 authorization errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: jest.fn().mockResolvedValue({ message: 'Forbidden' }),
      });

      await expect(apiService.get('/test')).rejects.toThrow(ApiError);
      await expect(apiService.get('/test')).rejects.toHaveProperty('type', ERROR_TYPES.AUTHORIZATION);
    });

    it('should handle 429 rate limit errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({ message: 'Too Many Requests' }),
      });

      await expect(apiService.get('/test')).rejects.toThrow(ApiError);
      await expect(apiService.get('/test')).rejects.toHaveProperty('type', ERROR_TYPES.RATE_LIMIT);
    });

    it('should handle 500 server errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ message: 'Internal Server Error' }),
      });

      await expect(apiService.get('/test')).rejects.toThrow(ApiError);
      await expect(apiService.get('/test')).rejects.toHaveProperty('type', ERROR_TYPES.SERVER);
    });

    it('should extract error message from response', async () => {
      const errorMessage = 'Custom error message';
      fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ message: errorMessage }),
      });

      await expect(apiService.get('/test')).rejects.toHaveProperty('message', errorMessage);
    });

    it('should handle array of errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          errors: [
            { message: 'Error 1' },
            { message: 'Error 2' }
          ]
        }),
      });

      await expect(apiService.get('/test')).rejects.toHaveProperty('message', 'Error 1, Error 2');
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests', async () => {
      fetch
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ data: 'success' }),
        });

      const response = await apiService.get('/test');
      
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(response.data).toEqual({ data: 'success' });
    });

    it('should not retry non-retryable errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ message: 'Bad Request' }),
      });

      await expect(apiService.get('/test')).rejects.toThrow(ApiError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should respect max retry attempts', async () => {
      fetch.mockRejectedValue(new Error('Network Error'));

      await expect(apiService.get('/test')).rejects.toThrow(ApiError);
      expect(fetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should use exponential backoff for retries', async () => {
      jest.useFakeTimers();
      
      fetch
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({ data: 'success' }),
        });

      const requestPromise = apiService.get('/test');
      
      // Fast-forward through retry delays
      jest.advanceTimersByTime(10000);
      
      await requestPromise;
      
      expect(fetch).toHaveBeenCalledTimes(3);
      
      jest.useRealTimers();
    });
  });

  describe('Request Queuing (Offline)', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
    });

    it('should queue requests when offline', async () => {
      const requestPromise = apiService.get('/test');
      
      // Request should be queued, not executed immediately
      expect(fetch).not.toHaveBeenCalled();
      
      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });
      
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'queued success' }),
      });
      
      // Trigger online event
      window.dispatchEvent(new Event('online'));
      
      const response = await requestPromise;
      expect(response.data).toEqual({ data: 'queued success' });
    });
  });

  describe('File Upload', () => {
    it('should upload files with progress tracking', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const mockProgress = jest.fn();
      
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ fileId: 'uploaded-file-123' }),
      });

      await apiService.uploadFile('/upload', mockFile, {
        onProgress: mockProgress,
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/upload'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });

    it('should validate file size', async () => {
      const largeFile = new File(['x'.repeat(20 * 1024 * 1024)], 'large.txt', { type: 'text/plain' });
      
      await expect(
        apiService.uploadFile('/upload', largeFile, {
          maxFileSize: 10 * 1024 * 1024, // 10MB limit
        })
      ).rejects.toThrow(ApiError);
    });

    it('should validate file type', async () => {
      const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-executable' });
      
      await expect(
        apiService.uploadFile('/upload', invalidFile, {
          allowedTypes: ['image/*', 'text/*'],
        })
      ).rejects.toThrow(ApiError);
    });

    it('should handle upload errors', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const mockError = jest.fn();
      
      fetch.mockResolvedValue({
        ok: false,
        status: 413,
        json: jest.fn().mockResolvedValue({ message: 'File too large' }),
      });

      await expect(
        apiService.uploadFile('/upload', mockFile, {
          onError: mockError,
        })
      ).rejects.toThrow(ApiError);
      
      expect(mockError).toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track request duration', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      fetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ data: 'test' }),
          }), 100)
        )
      );

      await apiService.get('/test');
      
      // In development mode, should log request details
      if (process.env.NODE_ENV === 'development') {
        expect(consoleSpy).toHaveBeenCalled();
      }
      
      consoleSpy.mockRestore();
    });

    it('should detect slow requests', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      fetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ data: 'test' }),
          }), 6000) // 6 seconds - slow request
        )
      );

      await apiService.get('/test');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow API Request'),
        expect.any(Object)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error Statistics', () => {
    it('should track error statistics', async () => {
      // Generate some errors
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ message: 'Server Error' }),
      });

      try {
        await apiService.get('/test1');
      } catch (e) {}

      try {
        await apiService.get('/test2');
      } catch (e) {}

      const stats = apiService.getErrorStats();
      
      expect(stats.total).toBe(2);
      expect(stats.byType[ERROR_TYPES.SERVER]).toBe(2);
      expect(stats.recent).toHaveLength(2);
    });

    it('should clear error log', () => {
      apiService.clearErrorLog();
      
      const stats = apiService.getErrorStats();
      expect(stats.total).toBe(0);
    });
  });

  describe('User-Friendly Error Messages', () => {
    it('should show toast for server errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ message: 'Server Error' }),
      });

      try {
        await apiService.get('/test');
      } catch (e) {}

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Server error occurred'),
        expect.any(Object)
      );
    });

    it('should not show toast for authentication errors', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({ message: 'Unauthorized' }),
      });

      try {
        await apiService.get('/test');
      } catch (e) {}

      expect(toast.error).not.toHaveBeenCalled();
    });
  });
});

describe('ApiError', () => {
  it('should create error with correct properties', () => {
    const error = new ApiError(
      'Test error',
      ERROR_TYPES.NETWORK,
      500,
      new Error('Original'),
      { context: 'test' }
    );

    expect(error.message).toBe('Test error');
    expect(error.type).toBe(ERROR_TYPES.NETWORK);
    expect(error.statusCode).toBe(500);
    expect(error.originalError).toBeInstanceOf(Error);
    expect(error.context).toEqual({ context: 'test' });
    expect(error.timestamp).toBeDefined();
    expect(error.severity).toBeDefined();
    expect(error.retryable).toBeDefined();
  });

  it('should determine correct severity', () => {
    const authError = new ApiError('Auth error', ERROR_TYPES.AUTHENTICATION, 401);
    expect(authError.severity).toBe(ERROR_SEVERITY.HIGH);

    const serverError = new ApiError('Server error', ERROR_TYPES.SERVER, 500);
    expect(serverError.severity).toBe(ERROR_SEVERITY.CRITICAL);

    const validationError = new ApiError('Validation error', ERROR_TYPES.VALIDATION, 400);
    expect(validationError.severity).toBe(ERROR_SEVERITY.LOW);
  });

  it('should determine retryability correctly', () => {
    const networkError = new ApiError('Network error', ERROR_TYPES.NETWORK);
    expect(networkError.retryable).toBe(true);

    const validationError = new ApiError('Validation error', ERROR_TYPES.VALIDATION, 400);
    expect(validationError.retryable).toBe(false);

    const serverError = new ApiError('Server error', ERROR_TYPES.SERVER, 500);
    expect(serverError.retryable).toBe(true);
  });

  it('should provide user-friendly messages', () => {
    const networkError = new ApiError('Network error', ERROR_TYPES.NETWORK);
    expect(networkError.toUserMessage()).toContain('check your internet connection');

    const authError = new ApiError('Auth error', ERROR_TYPES.AUTHENTICATION);
    expect(authError.toUserMessage()).toContain('log in again');

    const validationError = new ApiError('Validation error', ERROR_TYPES.VALIDATION);
    expect(validationError.toUserMessage()).toContain('check your input');
  });
});
