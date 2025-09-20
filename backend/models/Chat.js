const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Chat name cannot be more than 100 characters']
  },
  isGroupChat: {
    type: Boolean,
    default: false
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  groupAvatar: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  }
}, {
  timestamps: true
});

// Index for faster queries
chatSchema.index({ participants: 1 });
chatSchema.index({ updatedAt: -1 });

// Virtual for getting the other participant in a one-on-one chat
chatSchema.virtual('otherParticipant').get(function() {
  if (!this.isGroupChat && this.participants.length === 2) {
    return this.participants.find(p => p._id.toString() !== this.currentUserId);
  }
  return null;
});

// Pre-populate participants and lastMessage
chatSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'participants',
    select: 'name email avatar isOnline lastSeen'
  }).populate({
    path: 'lastMessage',
    select: 'content sender timestamp messageType'
  }).populate({
    path: 'admin',
    select: 'name email avatar'
  });
  next();
});

module.exports = mongoose.model('Chat', chatSchema);
