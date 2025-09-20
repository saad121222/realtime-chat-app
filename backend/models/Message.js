const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: function() {
      return this.messageType === 'text';
    },
    maxlength: [1000, 'Message cannot be more than 1000 characters']
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'audio', 'video'],
    default: 'text'
  },
  fileUrl: {
    type: String,
    required: function() {
      return ['image', 'file', 'audio', 'video'].includes(this.messageType);
    }
  },
  fileName: {
    type: String
  },
  fileSize: {
    type: Number
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  deliveredTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveredAt: {
      type: Date,
      default: Date.now
    }
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster queries
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

// Pre-populate sender and replyTo
messageSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'sender',
    select: 'name email avatar'
  }).populate({
    path: 'replyTo',
    select: 'content sender messageType createdAt',
    populate: {
      path: 'sender',
      select: 'name'
    }
  });
  next();
});

// Update message status
messageSchema.methods.updateStatus = function(status, userId) {
  if (status === 'delivered' && !this.deliveredTo.some(d => d.user.toString() === userId)) {
    this.deliveredTo.push({ user: userId });
  } else if (status === 'read' && !this.readBy.some(r => r.user.toString() === userId)) {
    this.readBy.push({ user: userId });
  }
  
  // Update overall status based on all recipients
  if (status === 'read') {
    this.status = 'read';
  } else if (status === 'delivered' && this.status === 'sent') {
    this.status = 'delivered';
  }
};

module.exports = mongoose.model('Message', messageSchema);
