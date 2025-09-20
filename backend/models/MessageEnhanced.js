const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: function() {
      return this.messageType === 'text' && !this.fileUrl;
    },
    maxlength: [4000, 'Message content cannot exceed 4000 characters'],
    trim: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserEnhanced',
    required: [true, 'Sender is required']
  },
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: [true, 'Chat is required']
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact'],
    default: 'text'
  },
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  // File-related fields
  fileUrl: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: ''
  },
  fileSize: {
    type: Number,
    default: 0
  },
  fileMimeType: {
    type: String,
    default: ''
  },
  // Message metadata
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MessageEnhanced',
    default: null
  },
  isForwarded: {
    type: Boolean,
    default: false
  },
  forwardedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserEnhanced',
    default: null
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  // Delivery tracking
  deliveredTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserEnhanced'
    },
    deliveredAt: {
      type: Date,
      default: Date.now
    }
  }],
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserEnhanced'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Emoji reactions
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserEnhanced'
    },
    emoji: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Location data (for location messages)
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  // Contact data (for contact messages)
  contact: {
    name: String,
    phoneNumber: String,
    email: String
  },
  // Message expiry (for disappearing messages)
  expiresAt: {
    type: Date,
    default: null
  },
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserEnhanced',
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better performance
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ status: 1 });
messageSchema.index({ messageType: 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
messageSchema.index({ isDeleted: 1, createdAt: -1 });

// Virtual for checking if message is read by specific user
messageSchema.virtual('isReadBy').get(function() {
  return (userId) => {
    return this.readBy.some(read => read.user.toString() === userId.toString());
  };
});

// Virtual for checking if message is delivered to specific user
messageSchema.virtual('isDeliveredTo').get(function() {
  return (userId) => {
    return this.deliveredTo.some(delivery => delivery.user.toString() === userId.toString());
  };
});

// Method to mark message as delivered to a user
messageSchema.methods.markAsDelivered = function(userId) {
  if (!this.isDeliveredTo(userId)) {
    this.deliveredTo.push({
      user: userId,
      deliveredAt: new Date()
    });
    
    // Update overall status if not already read
    if (this.status === 'sent') {
      this.status = 'delivered';
    }
  }
  return this.save();
};

// Method to mark message as read by a user
messageSchema.methods.markAsRead = function(userId) {
  // First ensure it's marked as delivered
  if (!this.isDeliveredTo(userId)) {
    this.deliveredTo.push({
      user: userId,
      deliveredAt: new Date()
    });
  }
  
  // Mark as read if not already
  if (!this.isReadBy(userId)) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
    
    // Update overall status
    this.status = 'read';
  }
  return this.save();
};

// Method to add reaction
messageSchema.methods.addReaction = function(userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(
    reaction => reaction.user.toString() !== userId.toString()
  );
  
  // Add new reaction
  this.reactions.push({
    user: userId,
    emoji,
    createdAt: new Date()
  });
  
  return this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(
    reaction => reaction.user.toString() !== userId.toString()
  );
  return this.save();
};

// Method to soft delete message
messageSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

// Method to edit message content
messageSchema.methods.editContent = function(newContent) {
  if (this.messageType !== 'text') {
    throw new Error('Only text messages can be edited');
  }
  
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  return this.save();
};

// Static method to get messages for a chat with pagination
messageSchema.statics.getMessagesForChat = function(chatId, options = {}) {
  const {
    page = 1,
    limit = 50,
    before = null,
    after = null,
    includeDeleted = false
  } = options;

  let query = { chat: chatId };
  
  if (!includeDeleted) {
    query.isDeleted = false;
  }
  
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }
  
  if (after) {
    query.createdAt = { $gt: new Date(after) };
  }

  return this.find(query)
    .populate('sender', 'name avatar phoneNumber')
    .populate('replyTo', 'content sender messageType')
    .populate('reactions.user', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

// Static method to get unread message count for user
messageSchema.statics.getUnreadCount = function(userId, chatId = null) {
  let query = {
    sender: { $ne: userId },
    'readBy.user': { $ne: userId },
    isDeleted: false
  };
  
  if (chatId) {
    query.chat = chatId;
  }
  
  return this.countDocuments(query);
};

// Static method to mark all messages in chat as read by user
messageSchema.statics.markChatAsRead = function(chatId, userId) {
  return this.updateMany(
    {
      chat: chatId,
      sender: { $ne: userId },
      'readBy.user': { $ne: userId },
      isDeleted: false
    },
    {
      $push: {
        readBy: {
          user: userId,
          readAt: new Date()
        }
      },
      $set: { status: 'read' }
    }
  );
};

// Pre-save middleware to handle message validation
messageSchema.pre('save', function(next) {
  // Ensure content exists for text messages
  if (this.messageType === 'text' && !this.content && !this.fileUrl) {
    return next(new Error('Text messages must have content'));
  }
  
  // Ensure file URL exists for non-text messages
  if (this.messageType !== 'text' && !this.fileUrl) {
    return next(new Error('Non-text messages must have a file URL'));
  }
  
  next();
});

// Transform output to include computed fields
messageSchema.methods.toJSON = function() {
  const message = this.toObject();
  
  // Add computed fields
  message.isRead = this.readBy.length > 0;
  message.isDelivered = this.deliveredTo.length > 0;
  message.reactionCount = this.reactions.length;
  
  // Format timestamps
  message.createdAt = this.createdAt;
  message.updatedAt = this.updatedAt;
  
  return message;
};

module.exports = mongoose.model('MessageEnhanced', messageSchema);
