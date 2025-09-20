const express = require('express');
const rateLimit = require('express-rate-limit');
const Message = require('../models/MessageEnhanced');
const Chat = require('../models/ChatEnhanced');
const { auth } = require('../middleware/authEnhanced');
const { getIO } = require('../socket/socketManager');

const router = express.Router();

// Rate limiting for messaging
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 messages per minute
  message: { message: 'Too many messages sent, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// @route   GET /api/messages/:chatId
// @desc    Get messages for a chat with pagination
// @access  Private
router.get('/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { 
      page = 1, 
      limit = 50, 
      before = null, 
      after = null 
    } = req.query;

    // Verify user is participant in chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get messages with pagination
    const messages = await Message.getMessagesForChat(chatId, {
      page: parseInt(page),
      limit: parseInt(limit),
      before,
      after
    });

    // Get total count for pagination
    const totalMessages = await Message.countDocuments({
      chat: chatId,
      isDeleted: false
    });

    // Mark messages as delivered to current user
    const undeliveredMessages = messages.filter(msg => 
      msg.sender.toString() !== req.user._id.toString() &&
      !msg.isDeliveredTo(req.user._id)
    );

    for (const message of undeliveredMessages) {
      await message.markAsDelivered(req.user._id);
    }

    res.json({
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalMessages,
        pages: Math.ceil(totalMessages / parseInt(limit)),
        hasMore: totalMessages > page * limit
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// @route   POST /api/messages
// @desc    Send a text message
// @access  Private
router.post('/', [auth, messageLimiter], async (req, res) => {
  try {
    const { content, chatId, replyTo = null, messageType = 'text' } = req.body;

    if (!content && messageType === 'text') {
      return res.status(400).json({ message: 'Message content is required' });
    }

    if (!chatId) {
      return res.status(400).json({ message: 'Chat ID is required' });
    }

    // Verify chat exists and user is participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check messaging permissions for groups
    if (chat.isGroup && chat.settings.messagingPermission === 'admins') {
      if (!chat.isAdmin(req.user._id)) {
        return res.status(403).json({ message: 'Only admins can send messages in this group' });
      }
    }

    // Create message
    const message = new Message({
      content: content?.trim(),
      sender: req.user._id,
      chat: chatId,
      messageType,
      replyTo,
      status: 'sent'
    });

    await message.save();

    // Update chat's last message
    await chat.updateLastMessage(message._id);

    // Populate message data for response
    await message.populate([
      { path: 'sender', select: 'name avatar phoneNumber' },
      { path: 'replyTo', select: 'content sender messageType' }
    ]);

    // Emit real-time message to chat participants
    const io = getIO();
    if (io) {
      // Get active participants (excluding sender)
      const activeParticipants = chat.participants
        .filter(p => p.isActive && p.user.toString() !== req.user._id.toString())
        .map(p => p.user.toString());

      // Emit to chat room
      io.to(`chat_${chatId}`).emit('new_message', {
        message: message.toJSON(),
        chatId
      });

      // Emit to individual users for notifications
      activeParticipants.forEach(userId => {
        io.to(`user_${userId}`).emit('message_notification', {
          message: message.toJSON(),
          chat: {
            _id: chat._id,
            name: chat.name,
            chatType: chat.chatType
          }
        });
      });
    }

    res.status(201).json({
      message: 'Message sent successfully',
      data: message.toJSON()
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

// @route   PUT /api/messages/:messageId/status
// @desc    Update message status (delivered/read)
// @access  Private
router.put('/:messageId/status', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;

    if (!['delivered', 'read'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Verify user is participant in the chat
    const chat = await Chat.findById(message.chat);
    if (!chat || !chat.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Don't update status for own messages
    if (message.sender.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot update status of own message' });
    }

    // Update message status
    if (status === 'delivered') {
      await message.markAsDelivered(req.user._id);
    } else if (status === 'read') {
      await message.markAsRead(req.user._id);
    }

    // Emit status update to sender
    const io = getIO();
    if (io) {
      io.to(`user_${message.sender}`).emit('message_status_update', {
        messageId: message._id,
        status,
        userId: req.user._id,
        chatId: message.chat
      });
    }

    res.json({
      message: 'Message status updated',
      status
    });
  } catch (error) {
    console.error('Update message status error:', error);
    res.status(500).json({ message: 'Failed to update message status' });
  }
});

// @route   PUT /api/messages/:messageId
// @desc    Edit message content
// @access  Private
router.put('/:messageId', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only sender can edit their message
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Can only edit your own messages' });
    }

    // Check if message is too old to edit (24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (message.createdAt < twentyFourHoursAgo) {
      return res.status(400).json({ message: 'Message is too old to edit' });
    }

    // Edit message
    await message.editContent(content.trim());
    await message.populate('sender', 'name avatar phoneNumber');

    // Emit message edit to chat participants
    const io = getIO();
    if (io) {
      io.to(`chat_${message.chat}`).emit('message_edited', {
        messageId: message._id,
        content: message.content,
        editedAt: message.editedAt,
        chatId: message.chat
      });
    }

    res.json({
      message: 'Message edited successfully',
      data: message.toJSON()
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ message: 'Failed to edit message' });
  }
});

// @route   DELETE /api/messages/:messageId
// @desc    Delete message
// @access  Private
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Verify user can delete this message
    const chat = await Chat.findById(message.chat);
    const canDelete = message.sender.toString() === req.user._id.toString() || 
                     (chat.isGroup && chat.isAdmin(req.user._id));

    if (!canDelete) {
      return res.status(403).json({ message: 'Cannot delete this message' });
    }

    // Soft delete message
    await message.softDelete(req.user._id);

    // Emit message deletion to chat participants
    const io = getIO();
    if (io) {
      io.to(`chat_${message.chat}`).emit('message_deleted', {
        messageId: message._id,
        chatId: message.chat,
        deletedBy: req.user._id
      });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Failed to delete message' });
  }
});

// @route   POST /api/messages/:messageId/reaction
// @desc    Add reaction to message
// @access  Private
router.post('/:messageId/reaction', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Verify user is participant in chat
    const chat = await Chat.findById(message.chat);
    if (!chat || !chat.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Add reaction
    await message.addReaction(req.user._id, emoji);
    await message.populate('reactions.user', 'name avatar');

    // Emit reaction to chat participants
    const io = getIO();
    if (io) {
      io.to(`chat_${message.chat}`).emit('message_reaction', {
        messageId: message._id,
        reaction: {
          user: {
            _id: req.user._id,
            name: req.user.name,
            avatar: req.user.avatar
          },
          emoji,
          createdAt: new Date()
        },
        chatId: message.chat
      });
    }

    res.json({
      message: 'Reaction added successfully',
      reactions: message.reactions
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ message: 'Failed to add reaction' });
  }
});

// @route   DELETE /api/messages/:messageId/reaction
// @desc    Remove reaction from message
// @access  Private
router.delete('/:messageId/reaction', auth, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Verify user is participant in chat
    const chat = await Chat.findById(message.chat);
    if (!chat || !chat.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Remove reaction
    await message.removeReaction(req.user._id);

    // Emit reaction removal to chat participants
    const io = getIO();
    if (io) {
      io.to(`chat_${message.chat}`).emit('message_reaction_removed', {
        messageId: message._id,
        userId: req.user._id,
        chatId: message.chat
      });
    }

    res.json({
      message: 'Reaction removed successfully',
      reactions: message.reactions
    });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ message: 'Failed to remove reaction' });
  }
});

// @route   POST /api/messages/:chatId/mark-read
// @desc    Mark all messages in chat as read
// @access  Private
router.post('/:chatId/mark-read', auth, async (req, res) => {
  try {
    const { chatId } = req.params;

    // Verify chat exists and user is participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Mark all messages as read
    await Message.markChatAsRead(chatId, req.user._id);

    // Emit read status to other participants
    const io = getIO();
    if (io) {
      io.to(`chat_${chatId}`).emit('chat_messages_read', {
        chatId,
        userId: req.user._id,
        readAt: new Date()
      });
    }

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({ message: 'Failed to mark messages as read' });
  }
});

// @route   GET /api/messages/unread/count
// @desc    Get unread message count for user
// @access  Private
router.get('/unread/count', auth, async (req, res) => {
  try {
    const { chatId } = req.query;

    const unreadCount = await Message.getUnreadCount(req.user._id, chatId);

    res.json({
      unreadCount,
      chatId: chatId || null
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Failed to get unread count' });
  }
});

module.exports = router;
