const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Chat name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Chat description cannot exceed 500 characters']
  },
  chatType: {
    type: String,
    enum: ['direct', 'group', 'broadcast'],
    default: 'direct'
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserEnhanced',
      required: true
    },
    role: {
      type: String,
      enum: ['member', 'admin', 'owner'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // Participant-specific settings
    isMuted: {
      type: Boolean,
      default: false
    },
    mutedUntil: {
      type: Date,
      default: null
    },
    customName: {
      type: String,
      default: ''
    }
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MessageEnhanced',
    default: null
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  // Group chat specific fields
  avatar: {
    type: String,
    default: ''
  },
  settings: {
    // Who can send messages
    messagingPermission: {
      type: String,
      enum: ['all', 'admins'],
      default: 'all'
    },
    // Who can edit group info
    editPermission: {
      type: String,
      enum: ['all', 'admins'],
      default: 'admins'
    },
    // Who can add participants
    addParticipantsPermission: {
      type: String,
      enum: ['all', 'admins'],
      default: 'admins'
    },
    // Disappearing messages
    disappearingMessages: {
      enabled: {
        type: Boolean,
        default: false
      },
      duration: {
        type: Number, // in seconds
        default: 604800 // 7 days
      }
    }
  },
  // Chat statistics
  messageCount: {
    type: Number,
    default: 0
  },
  // Typing indicators
  currentlyTyping: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserEnhanced'
    },
    startedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Pinned messages
  pinnedMessages: [{
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MessageEnhanced'
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserEnhanced'
    },
    pinnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Archive status for participants
  archivedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserEnhanced'
    },
    archivedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better performance
chatSchema.index({ participants: 1 });
chatSchema.index({ chatType: 1 });
chatSchema.index({ lastActivity: -1 });
chatSchema.index({ 'participants.user': 1, 'participants.isActive': 1 });
chatSchema.index({ isDeleted: 1, lastActivity: -1 });

// Virtual for active participants count
chatSchema.virtual('activeParticipantsCount').get(function() {
  return this.participants.filter(p => p.isActive).length;
});

// Virtual for checking if chat is group
chatSchema.virtual('isGroup').get(function() {
  return this.chatType === 'group';
});

// Virtual for checking if chat is direct
chatSchema.virtual('isDirect').get(function() {
  return this.chatType === 'direct';
});

// Method to add participant
chatSchema.methods.addParticipant = function(userId, role = 'member', addedBy = null) {
  // Check if user is already a participant
  const existingParticipant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );

  if (existingParticipant) {
    if (!existingParticipant.isActive) {
      // Reactivate participant
      existingParticipant.isActive = true;
      existingParticipant.leftAt = null;
      existingParticipant.joinedAt = new Date();
    }
    return this.save();
  }

  // Add new participant
  this.participants.push({
    user: userId,
    role,
    joinedAt: new Date(),
    isActive: true
  });

  return this.save();
};

// Method to remove participant
chatSchema.methods.removeParticipant = function(userId, removedBy = null) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );

  if (participant) {
    participant.isActive = false;
    participant.leftAt = new Date();
  }

  return this.save();
};

// Method to update participant role
chatSchema.methods.updateParticipantRole = function(userId, newRole) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString() && p.isActive
  );

  if (participant) {
    participant.role = newRole;
  }

  return this.save();
};

// Method to check if user is participant
chatSchema.methods.isParticipant = function(userId) {
  return this.participants.some(
    p => p.user.toString() === userId.toString() && p.isActive
  );
};

// Method to check if user is admin
chatSchema.methods.isAdmin = function(userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString() && p.isActive
  );
  return participant && (participant.role === 'admin' || participant.role === 'owner');
};

// Method to get participant info
chatSchema.methods.getParticipant = function(userId) {
  return this.participants.find(
    p => p.user.toString() === userId.toString()
  );
};

// Method to update last message
chatSchema.methods.updateLastMessage = function(messageId) {
  this.lastMessage = messageId;
  this.lastActivity = new Date();
  this.messageCount += 1;
  return this.save();
};

// Method to add typing indicator
chatSchema.methods.addTypingUser = function(userId) {
  // Remove existing typing indicator for this user
  this.currentlyTyping = this.currentlyTyping.filter(
    t => t.user.toString() !== userId.toString()
  );

  // Add new typing indicator
  this.currentlyTyping.push({
    user: userId,
    startedAt: new Date()
  });

  return this.save();
};

// Method to remove typing indicator
chatSchema.methods.removeTypingUser = function(userId) {
  this.currentlyTyping = this.currentlyTyping.filter(
    t => t.user.toString() !== userId.toString()
  );

  return this.save();
};

// Method to clean old typing indicators
chatSchema.methods.cleanOldTypingIndicators = function() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  this.currentlyTyping = this.currentlyTyping.filter(
    t => t.startedAt > fiveMinutesAgo
  );

  return this.save();
};

// Method to pin message
chatSchema.methods.pinMessage = function(messageId, pinnedBy) {
  // Check if message is already pinned
  const existingPin = this.pinnedMessages.find(
    p => p.message.toString() === messageId.toString()
  );

  if (!existingPin) {
    this.pinnedMessages.push({
      message: messageId,
      pinnedBy,
      pinnedAt: new Date()
    });
  }

  return this.save();
};

// Method to unpin message
chatSchema.methods.unpinMessage = function(messageId) {
  this.pinnedMessages = this.pinnedMessages.filter(
    p => p.message.toString() !== messageId.toString()
  );

  return this.save();
};

// Method to archive chat for user
chatSchema.methods.archiveForUser = function(userId) {
  // Remove existing archive entry
  this.archivedBy = this.archivedBy.filter(
    a => a.user.toString() !== userId.toString()
  );

  // Add new archive entry
  this.archivedBy.push({
    user: userId,
    archivedAt: new Date()
  });

  return this.save();
};

// Method to unarchive chat for user
chatSchema.methods.unarchiveForUser = function(userId) {
  this.archivedBy = this.archivedBy.filter(
    a => a.user.toString() !== userId.toString()
  );

  return this.save();
};

// Method to check if chat is archived for user
chatSchema.methods.isArchivedForUser = function(userId) {
  return this.archivedBy.some(
    a => a.user.toString() === userId.toString()
  );
};

// Static method to find chats for user
chatSchema.statics.findChatsForUser = function(userId, options = {}) {
  const {
    includeArchived = false,
    chatType = null,
    page = 1,
    limit = 20
  } = options;

  let query = {
    'participants.user': userId,
    'participants.isActive': true,
    isDeleted: false
  };

  if (chatType) {
    query.chatType = chatType;
  }

  let aggregation = [
    { $match: query },
    {
      $lookup: {
        from: 'messageenhanceds',
        localField: 'lastMessage',
        foreignField: '_id',
        as: 'lastMessageData'
      }
    },
    {
      $lookup: {
        from: 'userenhanceds',
        localField: 'participants.user',
        foreignField: '_id',
        as: 'participantUsers'
      }
    }
  ];

  if (!includeArchived) {
    aggregation.push({
      $match: {
        'archivedBy.user': { $ne: userId }
      }
    });
  }

  aggregation.push(
    { $sort: { lastActivity: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit }
  );

  return this.aggregate(aggregation);
};

// Static method to create direct chat
chatSchema.statics.createDirectChat = function(user1Id, user2Id) {
  // Check if direct chat already exists
  return this.findOne({
    chatType: 'direct',
    'participants.user': { $all: [user1Id, user2Id] },
    'participants.isActive': true,
    isDeleted: false
  }).then(existingChat => {
    if (existingChat) {
      return existingChat;
    }

    // Create new direct chat
    const newChat = new this({
      chatType: 'direct',
      participants: [
        { user: user1Id, role: 'member', isActive: true },
        { user: user2Id, role: 'member', isActive: true }
      ],
      lastActivity: new Date()
    });

    return newChat.save();
  });
};

// Pre-save middleware
chatSchema.pre('save', function(next) {
  // Update lastActivity when chat is modified
  this.lastActivity = new Date();
  next();
});

// Transform output
chatSchema.methods.toJSON = function() {
  const chat = this.toObject();
  
  // Add computed fields
  chat.participantCount = this.activeParticipantsCount;
  chat.isGroup = this.isGroup;
  chat.isDirect = this.isDirect;
  
  return chat;
};

module.exports = mongoose.model('ChatEnhanced', chatSchema);
