import axios from 'axios';
import toast from 'react-hot-toast';

// Error types for better error handling
export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  SERVER: 'SERVER_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  MAINTENANCE: 'MAINTENANCE_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

class ApiError extends Error {
  constructor(message, type, statusCode, originalError, context = {}) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.severity = this.determineSeverity();
    this.retryable = this.isRetryable();
  }

  determineSeverity() {
    if (this.type === ERROR_TYPES.AUTHENTICATION || this.type === ERROR_TYPES.AUTHORIZATION) {
      return ERROR_SEVERITY.HIGH;
    }
    if (this.type === ERROR_TYPES.SERVER || this.statusCode >= 500) {
      return ERROR_SEVERITY.CRITICAL;
    }
    if (this.type === ERROR_TYPES.NETWORK || this.type === ERROR_TYPES.TIMEOUT) {
      return ERROR_SEVERITY.MEDIUM;
    }
    if (this.type === ERROR_TYPES.VALIDATION || this.statusCode >= 400) {
      return ERROR_SEVERITY.LOW;
    }
    return ERROR_SEVERITY.MEDIUM;
  }

  isRetryable() {
    const retryableTypes = [
      ERROR_TYPES.NETWORK,
      ERROR_TYPES.TIMEOUT,
      ERROR_TYPES.SERVER,
      ERROR_TYPES.RATE_LIMIT
    ];
    
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    
    return retryableTypes.includes(this.type) || 
           retryableStatusCodes.includes(this.statusCode);
  }

  toUserMessage() {
    const userMessages = {
      [ERROR_TYPES.NETWORK]: 'Unable to connect to the server. Please check your internet connection.',
      [ERROR_TYPES.AUTHENTICATION]: 'Please log in again to continue.',
      [ERROR_TYPES.AUTHORIZATION]: 'You don\'t have permission to perform this action.',
      [ERROR_TYPES.VALIDATION]: 'Please check your input and try again.',
      [ERROR_TYPES.SERVER]: 'Server error occurred. Please try again later.',
      [ERROR_TYPES.TIMEOUT]: 'Request timed out. Please try again.',
      [ERROR_TYPES.RATE_LIMIT]: 'Too many requests. Please wait a moment and try again.',
      [ERROR_TYPES.MAINTENANCE]: 'Service is temporarily unavailable for maintenance.',
      [ERROR_TYPES.UNKNOWN]: 'An unexpected error occurred. Please try again.'
    };

    return userMessages[this.type] || this.message;
  }
}

class ApiService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    this.timeout = 30000; // 30 seconds
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.retryMultiplier = 2; // Exponential backoff
    
    // Request/response interceptors
    this.setupInterceptors();
    
    // Error logging
    this.errorLog = [];
    this.maxErrorLogSize = 100;
    
    // Network status monitoring
    this.isOnline = navigator.onLine;
    this.setupNetworkMonitoring();
    
    // Request queue for offline scenarios
    this.requestQueue = [];
    this.isProcessingQueue = false;
  }

  setupInterceptors() {
    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracking
        config.requestId = this.generateRequestId();
        
        // Add timestamp
        config.startTime = Date.now();
        
        // Log request in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`🚀 API Request [${config.requestId}]:`, {
            method: config.method?.toUpperCase(),
            url: config.url,
            data: config.data
          });
        }

        return config;
      },
      (error) => {
        return Promise.reject(this.handleRequestError(error));
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Calculate request duration
        const duration = Date.now() - response.config.startTime;
        
        // Log successful response in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ API Response [${response.config.requestId}]:`, {
            status: response.status,
            duration: `${duration}ms`,
            data: response.data
          });
        }

        // Monitor slow requests
        if (duration > 5000) {
          this.logSlowRequest(response.config, duration);
        }

        return response;
      },
      (error) => {
        return Promise.reject(this.handleResponseError(error));
      }
    );
  }

  setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Network connection restored');
      toast.success('Connection restored');
      this.processRequestQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📵 Network connection lost');
      toast.error('Connection lost. Requests will be queued.');
    });
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  handleRequestError(error) {
    const apiError = new ApiError(
      'Request configuration error',
      ERROR_TYPES.UNKNOWN,
      null,
      error,
      { phase: 'request' }
    );

    this.logError(apiError);
    return apiError;
  }

  handleResponseError(error) {
    const { response, request, config } = error;
    
    let apiError;

    if (response) {
      // Server responded with error status
      const errorType = this.determineErrorType(response.status, response.data);
      const message = this.extractErrorMessage(response.data) || error.message;
      
      apiError = new ApiError(
        message,
        errorType,
        response.status,
        error,
        {
          requestId: config?.requestId,
          url: config?.url,
          method: config?.method,
          responseData: response.data
        }
      );
    } else if (request) {
      // Request made but no response received
      apiError = new ApiError(
        'Network error - no response received',
        ERROR_TYPES.NETWORK,
        null,
        error,
        {
          requestId: config?.requestId,
          url: config?.url,
          method: config?.method
        }
      );
    } else {
      // Request setup error
      apiError = new ApiError(
        error.message,
        ERROR_TYPES.UNKNOWN,
        null,
        error,
        {
          requestId: config?.requestId
        }
      );
    }

    // Log error
    this.logError(apiError);
    
    // Show user-friendly error message
    this.showErrorToUser(apiError);

    return apiError;
  }

  determineErrorType(statusCode, responseData) {
    if (statusCode === 401) return ERROR_TYPES.AUTHENTICATION;
    if (statusCode === 403) return ERROR_TYPES.AUTHORIZATION;
    if (statusCode === 408) return ERROR_TYPES.TIMEOUT;
    if (statusCode === 429) return ERROR_TYPES.RATE_LIMIT;
    if (statusCode >= 400 && statusCode < 500) return ERROR_TYPES.VALIDATION;
    if (statusCode >= 500) return ERROR_TYPES.SERVER;
    if (statusCode === 503 && responseData?.maintenance) return ERROR_TYPES.MAINTENANCE;
    
    return ERROR_TYPES.UNKNOWN;
  }

  extractErrorMessage(responseData) {
    if (typeof responseData === 'string') return responseData;
    if (responseData?.message) return responseData.message;
    if (responseData?.error) return responseData.error;
    if (responseData?.errors && Array.isArray(responseData.errors)) {
      return responseData.errors.map(err => err.message || err).join(', ');
    }
    return null;
  }

  logError(error) {
    // Add to error log
    this.errorLog.push({
      ...error,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getCurrentUserId()
    });

    // Trim log if too large
    if (this.errorLog.length > this.maxErrorLogSize) {
      this.errorLog.splice(0, this.errorLog.length - this.maxErrorLogSize);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 API Error:', error);
    }

    // Send to error monitoring service
    this.sendErrorToMonitoring(error);
  }

  logSlowRequest(config, duration) {
    const slowRequestData = {
      requestId: config.requestId,
      url: config.url,
      method: config.method,
      duration,
      timestamp: new Date().toISOString()
    };

    console.warn('🐌 Slow API Request:', slowRequestData);
    
    // Send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring('slow_request', slowRequestData);
    }
  }

  showErrorToUser(error) {
    // Don't show toast for certain error types
    const silentErrors = [ERROR_TYPES.AUTHENTICATION];
    
    if (silentErrors.includes(error.type)) {
      return;
    }

    // Show appropriate toast based on severity
    const message = error.toUserMessage();
    
    switch (error.severity) {
      case ERROR_SEVERITY.CRITICAL:
        toast.error(message, { duration: 6000 });
        break;
      case ERROR_SEVERITY.HIGH:
        toast.error(message, { duration: 4000 });
        break;
      case ERROR_SEVERITY.MEDIUM:
        toast.error(message);
        break;
      case ERROR_SEVERITY.LOW:
        toast(message, { icon: '⚠️' });
        break;
      default:
        toast.error(message);
    }
  }

  getCurrentUserId() {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      return user?.id || 'anonymous';
    } catch {
      return 'anonymous';
    }
  }

  sendErrorToMonitoring(error) {
    if (process.env.NODE_ENV === 'production') {
      // Send to external error monitoring service
      if (window.Sentry) {
        window.Sentry.captureException(error.originalError || error, {
          tags: {
            errorType: error.type,
            severity: error.severity
          },
          extra: error.context
        });
      }

      // Send to internal monitoring
      this.sendToMonitoring('api_error', error);
    }
  }

  sendToMonitoring(eventType, data) {
    // Queue monitoring data to be sent when online
    if (!this.isOnline) {
      return;
    }

    fetch('/api/monitoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, data, timestamp: new Date().toISOString() })
    }).catch(console.error);
  }

  // Retry logic with exponential backoff
  async retryRequest(requestFn, maxRetries = this.maxRetries) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // Don't retry if error is not retryable
        if (!error.retryable || attempt === maxRetries) {
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.retryDelay * Math.pow(this.retryMultiplier, attempt);
        const jitter = Math.random() * 0.1 * delay; // 10% jitter
        const totalDelay = delay + jitter;

        console.log(`⏳ Retrying request in ${totalDelay.toFixed(0)}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        await this.sleep(totalDelay);
      }
    }
    
    throw lastError;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Queue requests when offline
  queueRequest(requestFn, options = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        requestFn,
        resolve,
        reject,
        options,
        timestamp: Date.now()
      });

      // Process queue if online
      if (this.isOnline) {
        this.processRequestQueue();
      }
    });
  }

  async processRequestQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(`📤 Processing ${this.requestQueue.length} queued requests`);

    while (this.requestQueue.length > 0) {
      const queuedRequest = this.requestQueue.shift();
      
      try {
        const result = await queuedRequest.requestFn();
        queuedRequest.resolve(result);
      } catch (error) {
        queuedRequest.reject(error);
      }
    }

    this.isProcessingQueue = false;
    console.log('✅ Finished processing request queue');
  }

  // Main request method with retry logic
  async request(config) {
    const requestFn = () => this.client.request(config);

    // Queue request if offline
    if (!this.isOnline) {
      return this.queueRequest(requestFn);
    }

    // Execute with retry logic
    return this.retryRequest(requestFn);
  }

  // HTTP method shortcuts
  async get(url, config = {}) {
    return this.request({ method: 'GET', url, ...config });
  }

  async post(url, data, config = {}) {
    return this.request({ method: 'POST', url, data, ...config });
  }

  async put(url, data, config = {}) {
    return this.request({ method: 'PUT', url, data, ...config });
  }

  async patch(url, data, config = {}) {
    return this.request({ method: 'PATCH', url, data, ...config });
  }

  async delete(url, config = {}) {
    return this.request({ method: 'DELETE', url, ...config });
  }

  // File upload with progress tracking
  async uploadFile(url, file, options = {}) {
    const {
      onProgress,
      onError,
      maxFileSize = 10 * 1024 * 1024, // 10MB
      allowedTypes = ['image/*', 'video/*', 'audio/*', 'application/pdf']
    } = options;

    try {
      // Validate file
      this.validateFile(file, maxFileSize, allowedTypes);

      const formData = new FormData();
      formData.append('file', file);

      // Add additional data if provided
      if (options.data) {
        Object.keys(options.data).forEach(key => {
          formData.append(key, options.data[key]);
        });
      }

      const config = {
        method: 'POST',
        url,
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress?.(progress, progressEvent);
        },
        timeout: 60000 // 60 seconds for file uploads
      };

      return await this.request(config);
    } catch (error) {
      onError?.(error);
      throw error;
    }
  }

  validateFile(file, maxSize, allowedTypes) {
    if (!file) {
      throw new ApiError('No file provided', ERROR_TYPES.VALIDATION);
    }

    if (file.size > maxSize) {
      throw new ApiError(
        `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(maxSize / 1024 / 1024).toFixed(2)}MB)`,
        ERROR_TYPES.VALIDATION
      );
    }

    const isAllowedType = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.replace('/*', '/'));
      }
      return file.type === type;
    });

    if (!isAllowedType) {
      throw new ApiError(
        `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
        ERROR_TYPES.VALIDATION
      );
    }
  }

  // Get error statistics
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byType: {},
      bySeverity: {},
      recent: this.errorLog.slice(-10)
    };

    this.errorLog.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }

  // Clear error log
  clearErrorLog() {
    this.errorLog = [];
  }
}

// Create singleton instance
const apiService = new ApiService();

export default apiService;
export { ApiError, ERROR_TYPES, ERROR_SEVERITY };
