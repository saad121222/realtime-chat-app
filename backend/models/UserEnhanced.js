const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    sparse: true, // Allow multiple null values
    lowercase: true,
    validate: {
      validator: function(email) {
        return !email || validator.isEmail(email);
      },
      message: 'Please provide a valid email'
    }
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    validate: {
      validator: function(phone) {
        // International phone number format: +[country code][number]
        return /^\+[1-9]\d{1,14}$/.test(phone);
      },
      message: 'Please provide a valid phone number with country code (e.g., +1234567890)'
    }
  },
  password: {
    type: String,
    required: function() {
      return this.authMethod === 'password';
    },
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  authMethod: {
    type: String,
    enum: ['password', 'otp'],
    default: 'otp'
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  avatar: {
    type: String,
    default: ''
  },
  avatarPublicId: {
    type: String, // For cloud storage (Cloudinary, AWS S3)
    default: ''
  },
  status: {
    type: String,
    default: 'Hey there! I am using WhatsApp Clone.',
    maxlength: [500, 'Status cannot be more than 500 characters']
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  socketId: {
    type: String,
    default: ''
  },
  deviceInfo: {
    userAgent: String,
    platform: String,
    lastLoginIP: String
  },
  preferences: {
    language: {
      type: String,
      default: 'en'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'dark'
    },
    notifications: {
      messageSound: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true }
    },
    privacy: {
      lastSeen: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone'
      },
      profilePhoto: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone'
      },
      status: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone'
      }
    }
  },
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  passwordResetToken: String,
  passwordResetExpires: Date
}, {
  timestamps: true
});

// Indexes for better performance
userSchema.index({ phoneNumber: 1 });
userSchema.index({ email: 1 });
userSchema.index({ name: 'text', phoneNumber: 'text' });
userSchema.index({ isOnline: 1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware for password hashing
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  if (this.password) {
    try {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours

  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock the account if we've reached max attempts and it's not locked already
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to update online status
userSchema.methods.updateOnlineStatus = function(isOnline, socketId = '') {
  this.isOnline = isOnline;
  this.lastSeen = new Date();
  this.socketId = socketId;
  return this.save();
};

// Method to generate avatar URL
userSchema.methods.getAvatarUrl = function() {
  if (this.avatar) {
    // If it's a full URL, return as is
    if (this.avatar.startsWith('http')) {
      return this.avatar;
    }
    // If it's a local file, construct the URL
    return `/uploads/avatars/${this.avatar}`;
  }
  return '';
};

// Method to get safe user data for public use
userSchema.methods.toSafeObject = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.socketId;
  delete userObject.loginAttempts;
  delete userObject.lockUntil;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  delete userObject.deviceInfo;
  
  // Add computed fields
  userObject.avatarUrl = this.getAvatarUrl();
  
  return userObject;
};

// Transform output to remove sensitive fields
userSchema.methods.toJSON = function() {
  return this.toSafeObject();
};

// Static method to find by phone number
userSchema.statics.findByPhoneNumber = function(phoneNumber) {
  return this.findOne({ phoneNumber });
};

// Static method to search users
userSchema.statics.searchUsers = function(query, excludeUserId, limit = 20) {
  const searchRegex = new RegExp(query, 'i');
  return this.find({
    _id: { $ne: excludeUserId },
    $or: [
      { name: searchRegex },
      { phoneNumber: searchRegex }
    ]
  })
  .select('name phoneNumber avatar status isOnline lastSeen')
  .limit(limit)
  .sort({ name: 1 });
};

module.exports = mongoose.model('UserEnhanced', userSchema);
