import toast from 'react-hot-toast';
import apiService from './apiEnhanced';

// File upload error types
export const UPLOAD_ERROR_TYPES = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  FILE_CORRUPTED: 'FILE_CORRUPTED',
  UPLOAD_CANCELLED: 'UPLOAD_CANCELLED',
  TIMEOUT: 'TIMEOUT',
  DUPLICATE_FILE: 'DUPLICATE_FILE',
  VIRUS_DETECTED: 'VIRUS_DETECTED'
};

// Upload states
export const UPLOAD_STATES = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused'
};

class FileUploadError extends Error {
  constructor(message, type, file = null, originalError = null, context = {}) {
    super(message);
    this.name = 'FileUploadError';
    this.type = type;
    this.file = file;
    this.originalError = originalError;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.retryable = this.isRetryable();
  }

  isRetryable() {
    const retryableTypes = [
      UPLOAD_ERROR_TYPES.NETWORK_ERROR,
      UPLOAD_ERROR_TYPES.SERVER_ERROR,
      UPLOAD_ERROR_TYPES.TIMEOUT,
      UPLOAD_ERROR_TYPES.UPLOAD_FAILED
    ];
    
    return retryableTypes.includes(this.type);
  }

  toUserMessage() {
    const fileName = this.file?.name || 'file';
    
    const messages = {
      [UPLOAD_ERROR_TYPES.FILE_TOO_LARGE]: `${fileName} is too large. Maximum size allowed is ${this.context.maxSize || '10MB'}.`,
      [UPLOAD_ERROR_TYPES.INVALID_FILE_TYPE]: `${fileName} is not a supported file type. Allowed types: ${this.context.allowedTypes?.join(', ') || 'images, videos, documents'}.`,
      [UPLOAD_ERROR_TYPES.UPLOAD_FAILED]: `Failed to upload ${fileName}. Please try again.`,
      [UPLOAD_ERROR_TYPES.NETWORK_ERROR]: `Network error while uploading ${fileName}. Please check your connection.`,
      [UPLOAD_ERROR_TYPES.SERVER_ERROR]: `Server error occurred while uploading ${fileName}. Please try again later.`,
      [UPLOAD_ERROR_TYPES.QUOTA_EXCEEDED]: `Upload quota exceeded. Please free up some space and try again.`,
      [UPLOAD_ERROR_TYPES.PERMISSION_DENIED]: `Permission denied. You don't have access to upload files here.`,
      [UPLOAD_ERROR_TYPES.FILE_CORRUPTED]: `${fileName} appears to be corrupted. Please try with a different file.`,
      [UPLOAD_ERROR_TYPES.UPLOAD_CANCELLED]: `Upload of ${fileName} was cancelled.`,
      [UPLOAD_ERROR_TYPES.TIMEOUT]: `Upload of ${fileName} timed out. Please try again.`,
      [UPLOAD_ERROR_TYPES.DUPLICATE_FILE]: `${fileName} already exists. Choose a different name or replace the existing file.`,
      [UPLOAD_ERROR_TYPES.VIRUS_DETECTED]: `${fileName} failed security scan. Please scan your file for viruses.`
    };

    return messages[this.type] || this.message;
  }

  getSeverity() {
    const highSeverityTypes = [
      UPLOAD_ERROR_TYPES.VIRUS_DETECTED,
      UPLOAD_ERROR_TYPES.PERMISSION_DENIED,
      UPLOAD_ERROR_TYPES.QUOTA_EXCEEDED
    ];
    
    const mediumSeverityTypes = [
      UPLOAD_ERROR_TYPES.SERVER_ERROR,
      UPLOAD_ERROR_TYPES.FILE_CORRUPTED,
      UPLOAD_ERROR_TYPES.TIMEOUT
    ];
    
    if (highSeverityTypes.includes(this.type)) return 'high';
    if (mediumSeverityTypes.includes(this.type)) return 'medium';
    return 'low';
  }
}

class FileUploadManager {
  constructor() {
    this.uploads = new Map(); // Track active uploads
    this.uploadHistory = []; // Track completed/failed uploads
    this.maxConcurrentUploads = 3;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.chunkSize = 1024 * 1024; // 1MB chunks for large files
    this.largeFileThreshold = 10 * 1024 * 1024; // 10MB
    
    // Default file constraints
    this.defaultConstraints = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      allowedTypes: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'video/quicktime',
        'audio/mpeg', 'audio/wav', 'audio/ogg',
        'application/pdf', 'text/plain',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
      allowedExtensions: [
        '.jpg', '.jpeg', '.png', '.gif', '.webp',
        '.mp4', '.webm', '.mov',
        '.mp3', '.wav', '.ogg',
        '.pdf', '.txt', '.doc', '.docx'
      ]
    };

    // Error tracking
    this.errorLog = [];
    this.maxErrorLogSize = 100;
  }

  // Main upload method with comprehensive error handling
  async uploadFile(file, options = {}) {
    const uploadId = this.generateUploadId();
    
    try {
      // Validate file
      this.validateFile(file, options.constraints);
      
      // Create upload tracking
      const uploadInfo = this.createUploadInfo(uploadId, file, options);
      this.uploads.set(uploadId, uploadInfo);
      
      // Check concurrent upload limit
      await this.waitForUploadSlot();
      
      // Start upload
      const result = await this.performUpload(uploadId, file, options);
      
      // Mark as completed
      this.completeUpload(uploadId, result);
      
      return result;
      
    } catch (error) {
      this.handleUploadError(uploadId, error, file);
      throw error;
    }
  }

  generateUploadId() {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createUploadInfo(uploadId, file, options) {
    return {
      id: uploadId,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      },
      state: UPLOAD_STATES.PENDING,
      progress: 0,
      startTime: Date.now(),
      endTime: null,
      retryCount: 0,
      error: null,
      abortController: new AbortController(),
      options: options
    };
  }

  validateFile(file, constraints = {}) {
    const config = { ...this.defaultConstraints, ...constraints };
    
    // Check if file exists
    if (!file) {
      throw new FileUploadError(
        'No file provided',
        UPLOAD_ERROR_TYPES.INVALID_FILE_TYPE
      );
    }

    // Check file size
    if (file.size > config.maxFileSize) {
      throw new FileUploadError(
        `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(config.maxFileSize)})`,
        UPLOAD_ERROR_TYPES.FILE_TOO_LARGE,
        file,
        null,
        { maxSize: this.formatFileSize(config.maxFileSize) }
      );
    }

    // Check file type
    const isValidType = config.allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.replace('/*', '/'));
      }
      return file.type === type;
    });

    // Check file extension as fallback
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    const isValidExtension = config.allowedExtensions.includes(fileExtension);

    if (!isValidType && !isValidExtension) {
      throw new FileUploadError(
        `File type ${file.type} is not supported`,
        UPLOAD_ERROR_TYPES.INVALID_FILE_TYPE,
        file,
        null,
        { allowedTypes: config.allowedTypes }
      );
    }

    // Check for empty files
    if (file.size === 0) {
      throw new FileUploadError(
        'Cannot upload empty files',
        UPLOAD_ERROR_TYPES.FILE_CORRUPTED,
        file
      );
    }

    // Additional validation for specific file types
    this.validateSpecificFileType(file);
  }

  validateSpecificFileType(file) {
    // Image validation
    if (file.type.startsWith('image/')) {
      this.validateImage(file);
    }
    
    // Video validation
    if (file.type.startsWith('video/')) {
      this.validateVideo(file);
    }
    
    // Document validation
    if (file.type.includes('document') || file.type === 'application/pdf') {
      this.validateDocument(file);
    }
  }

  validateImage(file) {
    const maxImageSize = 20 * 1024 * 1024; // 20MB for images
    
    if (file.size > maxImageSize) {
      throw new FileUploadError(
        `Image file too large. Maximum size for images is ${this.formatFileSize(maxImageSize)}`,
        UPLOAD_ERROR_TYPES.FILE_TOO_LARGE,
        file,
        null,
        { maxSize: this.formatFileSize(maxImageSize) }
      );
    }
  }

  validateVideo(file) {
    const maxVideoSize = 100 * 1024 * 1024; // 100MB for videos
    
    if (file.size > maxVideoSize) {
      throw new FileUploadError(
        `Video file too large. Maximum size for videos is ${this.formatFileSize(maxVideoSize)}`,
        UPLOAD_ERROR_TYPES.FILE_TOO_LARGE,
        file,
        null,
        { maxSize: this.formatFileSize(maxVideoSize) }
      );
    }
  }

  validateDocument(file) {
    const maxDocSize = 25 * 1024 * 1024; // 25MB for documents
    
    if (file.size > maxDocSize) {
      throw new FileUploadError(
        `Document file too large. Maximum size for documents is ${this.formatFileSize(maxDocSize)}`,
        UPLOAD_ERROR_TYPES.FILE_TOO_LARGE,
        file,
        null,
        { maxSize: this.formatFileSize(maxDocSize) }
      );
    }
  }

  async waitForUploadSlot() {
    const activeUploads = Array.from(this.uploads.values())
      .filter(upload => upload.state === UPLOAD_STATES.UPLOADING).length;
    
    if (activeUploads >= this.maxConcurrentUploads) {
      // Wait for a slot to become available
      await new Promise(resolve => {
        const checkSlot = () => {
          const currentActive = Array.from(this.uploads.values())
            .filter(upload => upload.state === UPLOAD_STATES.UPLOADING).length;
          
          if (currentActive < this.maxConcurrentUploads) {
            resolve();
          } else {
            setTimeout(checkSlot, 500);
          }
        };
        checkSlot();
      });
    }
  }

  async performUpload(uploadId, file, options) {
    const uploadInfo = this.uploads.get(uploadId);
    uploadInfo.state = UPLOAD_STATES.UPLOADING;
    
    try {
      // Determine upload strategy based on file size
      if (file.size > this.largeFileThreshold) {
        return await this.performChunkedUpload(uploadId, file, options);
      } else {
        return await this.performSimpleUpload(uploadId, file, options);
      }
    } catch (error) {
      // Handle specific upload errors
      const uploadError = this.classifyUploadError(error, file);
      
      // Retry if error is retryable
      if (uploadError.retryable && uploadInfo.retryCount < this.maxRetries) {
        return await this.retryUpload(uploadId, file, options, uploadError);
      }
      
      throw uploadError;
    }
  }

  async performSimpleUpload(uploadId, file, options) {
    const uploadInfo = this.uploads.get(uploadId);
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Add additional data
    if (options.data) {
      Object.keys(options.data).forEach(key => {
        formData.append(key, options.data[key]);
      });
    }

    const config = {
      method: 'POST',
      url: options.endpoint || '/api/files/upload',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal: uploadInfo.abortController.signal,
      timeout: options.timeout || 60000,
      onUploadProgress: (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        this.updateUploadProgress(uploadId, progress);
        options.onProgress?.(progress, progressEvent);
      }
    };

    const response = await apiService.request(config);
    return response.data;
  }

  async performChunkedUpload(uploadId, file, options) {
    const uploadInfo = this.uploads.get(uploadId);
    const totalChunks = Math.ceil(file.size / this.chunkSize);
    let uploadedChunks = 0;
    
    // Initialize chunked upload
    const initResponse = await apiService.post('/api/files/upload/init', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      totalChunks,
      ...options.data
    });
    
    const uploadSession = initResponse.data.uploadSession;
    
    try {
      // Upload chunks
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (uploadInfo.abortController.signal.aborted) {
          throw new FileUploadError(
            'Upload cancelled by user',
            UPLOAD_ERROR_TYPES.UPLOAD_CANCELLED,
            file
          );
        }
        
        const start = chunkIndex * this.chunkSize;
        const end = Math.min(start + this.chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        await this.uploadChunk(uploadSession, chunkIndex, chunk, uploadInfo.abortController.signal);
        
        uploadedChunks++;
        const progress = Math.round((uploadedChunks / totalChunks) * 100);
        this.updateUploadProgress(uploadId, progress);
        options.onProgress?.(progress);
      }
      
      // Finalize upload
      const finalizeResponse = await apiService.post('/api/files/upload/finalize', {
        uploadSession
      });
      
      return finalizeResponse.data;
      
    } catch (error) {
      // Cleanup failed chunked upload
      await this.cleanupChunkedUpload(uploadSession);
      throw error;
    }
  }

  async uploadChunk(uploadSession, chunkIndex, chunk, abortSignal) {
    const formData = new FormData();
    formData.append('uploadSession', uploadSession);
    formData.append('chunkIndex', chunkIndex);
    formData.append('chunk', chunk);
    
    const response = await apiService.post('/api/files/upload/chunk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: abortSignal,
      timeout: 30000
    });
    
    return response.data;
  }

  async cleanupChunkedUpload(uploadSession) {
    try {
      await apiService.delete(`/api/files/upload/cleanup/${uploadSession}`);
    } catch (error) {
      console.warn('Failed to cleanup chunked upload:', error);
    }
  }

  classifyUploadError(error, file) {
    // Network errors
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      return new FileUploadError(
        'Network error during upload',
        UPLOAD_ERROR_TYPES.NETWORK_ERROR,
        file,
        error
      );
    }
    
    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return new FileUploadError(
        'Upload timed out',
        UPLOAD_ERROR_TYPES.TIMEOUT,
        file,
        error
      );
    }
    
    // Server errors based on status code
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 413:
          return new FileUploadError(
            'File too large for server',
            UPLOAD_ERROR_TYPES.FILE_TOO_LARGE,
            file,
            error
          );
        case 415:
          return new FileUploadError(
            'Unsupported file type',
            UPLOAD_ERROR_TYPES.INVALID_FILE_TYPE,
            file,
            error
          );
        case 403:
          return new FileUploadError(
            'Permission denied',
            UPLOAD_ERROR_TYPES.PERMISSION_DENIED,
            file,
            error
          );
        case 409:
          return new FileUploadError(
            'File already exists',
            UPLOAD_ERROR_TYPES.DUPLICATE_FILE,
            file,
            error
          );
        case 507:
          return new FileUploadError(
            'Storage quota exceeded',
            UPLOAD_ERROR_TYPES.QUOTA_EXCEEDED,
            file,
            error
          );
        default:
          if (status >= 500) {
            return new FileUploadError(
              'Server error during upload',
              UPLOAD_ERROR_TYPES.SERVER_ERROR,
              file,
              error
            );
          }
      }
      
      // Check for specific error messages
      if (data?.error?.includes('virus') || data?.error?.includes('malware')) {
        return new FileUploadError(
          'File failed security scan',
          UPLOAD_ERROR_TYPES.VIRUS_DETECTED,
          file,
          error
        );
      }
    }
    
    // Default to upload failed
    return new FileUploadError(
      'Upload failed',
      UPLOAD_ERROR_TYPES.UPLOAD_FAILED,
      file,
      error
    );
  }

  async retryUpload(uploadId, file, options, lastError) {
    const uploadInfo = this.uploads.get(uploadId);
    uploadInfo.retryCount++;
    uploadInfo.state = UPLOAD_STATES.PENDING;
    
    console.log(`🔄 Retrying upload ${uploadId} (attempt ${uploadInfo.retryCount}/${this.maxRetries})`);
    
    // Show retry message to user
    toast.loading(`Retrying upload of ${file.name}... (${uploadInfo.retryCount}/${this.maxRetries})`, {
      id: `retry-${uploadId}`
    });
    
    // Wait before retrying (exponential backoff)
    const delay = this.retryDelay * Math.pow(2, uploadInfo.retryCount - 1);
    await this.sleep(delay);
    
    try {
      const result = await this.performUpload(uploadId, file, options);
      toast.dismiss(`retry-${uploadId}`);
      return result;
    } catch (error) {
      toast.dismiss(`retry-${uploadId}`);
      throw error;
    }
  }

  updateUploadProgress(uploadId, progress) {
    const uploadInfo = this.uploads.get(uploadId);
    if (uploadInfo) {
      uploadInfo.progress = progress;
    }
  }

  completeUpload(uploadId, result) {
    const uploadInfo = this.uploads.get(uploadId);
    if (uploadInfo) {
      uploadInfo.state = UPLOAD_STATES.COMPLETED;
      uploadInfo.progress = 100;
      uploadInfo.endTime = Date.now();
      uploadInfo.result = result;
      
      // Move to history
      this.uploadHistory.push(uploadInfo);
      this.uploads.delete(uploadId);
      
      // Trim history
      if (this.uploadHistory.length > 50) {
        this.uploadHistory.splice(0, this.uploadHistory.length - 50);
      }
    }
  }

  handleUploadError(uploadId, error, file) {
    const uploadInfo = this.uploads.get(uploadId);
    
    if (uploadInfo) {
      uploadInfo.state = UPLOAD_STATES.FAILED;
      uploadInfo.error = error;
      uploadInfo.endTime = Date.now();
      
      // Move to history
      this.uploadHistory.push(uploadInfo);
      this.uploads.delete(uploadId);
    }
    
    // Log error
    this.logError(error, file);
    
    // Show user-friendly error message
    this.showErrorToUser(error);
  }

  logError(error, file) {
    const errorData = {
      ...error,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };
    
    this.errorLog.push(errorData);
    
    // Trim log
    if (this.errorLog.length > this.maxErrorLogSize) {
      this.errorLog.splice(0, this.errorLog.length - this.maxErrorLogSize);
    }
    
    // Send to monitoring
    this.sendErrorToMonitoring(errorData);
  }

  showErrorToUser(error) {
    const message = error.toUserMessage();
    const severity = error.getSeverity();
    
    switch (severity) {
      case 'high':
        toast.error(message, { duration: 6000 });
        break;
      case 'medium':
        toast.error(message, { duration: 4000 });
        break;
      default:
        toast.error(message);
    }
  }

  sendErrorToMonitoring(errorData) {
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/monitoring/upload-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData)
      }).catch(console.error);
    }
  }

  // Cancel upload
  cancelUpload(uploadId) {
    const uploadInfo = this.uploads.get(uploadId);
    if (uploadInfo) {
      uploadInfo.abortController.abort();
      uploadInfo.state = UPLOAD_STATES.CANCELLED;
      
      toast.success(`Upload of ${uploadInfo.file.name} cancelled`);
      
      // Move to history
      this.uploadHistory.push(uploadInfo);
      this.uploads.delete(uploadId);
    }
  }

  // Pause/resume upload (for chunked uploads)
  pauseUpload(uploadId) {
    const uploadInfo = this.uploads.get(uploadId);
    if (uploadInfo && uploadInfo.state === UPLOAD_STATES.UPLOADING) {
      uploadInfo.state = UPLOAD_STATES.PAUSED;
    }
  }

  resumeUpload(uploadId) {
    const uploadInfo = this.uploads.get(uploadId);
    if (uploadInfo && uploadInfo.state === UPLOAD_STATES.PAUSED) {
      uploadInfo.state = UPLOAD_STATES.UPLOADING;
      // Resume upload logic would go here
    }
  }

  // Utility methods
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get upload status
  getUploadStatus(uploadId) {
    return this.uploads.get(uploadId) || 
           this.uploadHistory.find(upload => upload.id === uploadId);
  }

  // Get all active uploads
  getActiveUploads() {
    return Array.from(this.uploads.values());
  }

  // Get upload statistics
  getUploadStats() {
    const active = this.getActiveUploads();
    const completed = this.uploadHistory.filter(u => u.state === UPLOAD_STATES.COMPLETED);
    const failed = this.uploadHistory.filter(u => u.state === UPLOAD_STATES.FAILED);
    
    return {
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      totalErrors: this.errorLog.length,
      errorsByType: this.getErrorsByType()
    };
  }

  getErrorsByType() {
    const errorsByType = {};
    this.errorLog.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    });
    return errorsByType;
  }
}

// Create singleton instance
const fileUploadManager = new FileUploadManager();

export default fileUploadManager;
export { FileUploadError, UPLOAD_ERROR_TYPES, UPLOAD_STATES };
