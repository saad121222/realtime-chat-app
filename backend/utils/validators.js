const validator = require('validator');

// Email validation
const isValidEmail = (email) => {
  return validator.isEmail(email);
};

// Password validation
const isValidPassword = (password) => {
  // At least 6 characters, contains at least one letter and one number
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/;
  return passwordRegex.test(password);
};

// Name validation
const isValidName = (name) => {
  return name && name.trim().length >= 2 && name.trim().length <= 50;
};

// File type validation
const isValidFileType = (mimetype) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  return allowedTypes.includes(mimetype);
};

// File size validation (in bytes)
const isValidFileSize = (size, maxSize = 50 * 1024 * 1024) => { // 50MB default
  return size <= maxSize;
};

// MongoDB ObjectId validation
const isValidObjectId = (id) => {
  return validator.isMongoId(id);
};

// Sanitize input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return validator.escape(input.trim());
};

// Chat name validation
const isValidChatName = (name) => {
  return name && name.trim().length >= 1 && name.trim().length <= 100;
};

// Message content validation
const isValidMessageContent = (content) => {
  return content && content.trim().length >= 1 && content.trim().length <= 1000;
};

module.exports = {
  isValidEmail,
  isValidPassword,
  isValidName,
  isValidFileType,
  isValidFileSize,
  isValidObjectId,
  sanitizeInput,
  isValidChatName,
  isValidMessageContent
};
