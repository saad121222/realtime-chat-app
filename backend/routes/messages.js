const express = require('express');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const auth = require('../middleware/auth');
const { upload, handleMulterError } = require('../middleware/upload');
const path = require('path');

const router = express.Router();

// @route   GET /api/messages/:chatId
// @desc    Get messages for a specific chat
// @access  Private
router.get('/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify user is part of the chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Get messages with pagination
    const messages = await Message.find({ chat: chatId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Reverse to show oldest first
    messages.reverse();

    // Mark messages as delivered for current user
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: req.user._id },
        'deliveredTo.user': { $ne: req.user._id }
      },
      {
        $push: { deliveredTo: { user: req.user._id } },
        $set: { status: 'delivered' }
      }
    );

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/messages
// @desc    Send a new message
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { content, chatId, messageType = 'text', replyTo } = req.body;

    if (!chatId) {
      return res.status(400).json({ message: 'Chat ID is required' });
    }

    if (messageType === 'text' && !content) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    // Verify user is part of the chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Create message
    const messageData = {
      content,
      sender: req.user._id,
      chat: chatId,
      messageType
    };

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    const message = new Message(messageData);
    await message.save();
    await message.populate('sender', 'name email avatar');
    await message.populate('replyTo');

    // Update chat's last message
    chat.lastMessage = message._id;
    chat.updatedAt = new Date();
    await chat.save();

    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/messages/file
// @desc    Send a file message
// @access  Private
router.post('/file', auth, upload.single('file'), handleMulterError, async (req, res) => {
  try {
    const { chatId, replyTo } = req.body;

    if (!chatId) {
      return res.status(400).json({ message: 'Chat ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }

    // Verify user is part of the chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Determine message type based on file mime type
    let messageType = 'file';
    if (req.file.mimetype.startsWith('image/')) {
      messageType = 'image';
    } else if (req.file.mimetype.startsWith('video/')) {
      messageType = 'video';
    } else if (req.file.mimetype.startsWith('audio/')) {
      messageType = 'audio';
    }

    // Create file URL with subdirectory
    // req.file.path -> .../uploads/<subdir>/<filename>
    const subdir = path.basename(path.dirname(req.file.path));
    const fileUrl = `/uploads/${subdir}/${req.file.filename}`;

    // Create message
    const messageData = {
      sender: req.user._id,
      chat: chatId,
      messageType,
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size
    };

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    const message = new Message(messageData);
    await message.save();
    await message.populate('sender', 'name email avatar');
    await message.populate('replyTo');

    // Update chat's last message
    chat.lastMessage = message._id;
    chat.updatedAt = new Date();
    await chat.save();

    res.status(201).json({
      message: 'File sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send file error:', error);
    res.status(500).json({ message: 'Server error' });
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

    // Verify user is part of the chat
    const chat = await Chat.findOne({
      _id: message.chat,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Don't update status for own messages
    if (message.sender.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot update status of own message' });
    }

    // Update message status
    message.updateStatus(status, req.user._id);
    await message.save();

    res.json({
      message: 'Message status updated successfully',
      data: message
    });
  } catch (error) {
    console.error('Update message status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/messages/:messageId
// @desc    Edit a message
// @access  Private
router.put('/:messageId', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const message = await Message.findOne({
      _id: messageId,
      sender: req.user._id,
      messageType: 'text'
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found or cannot be edited' });
    }

    // Update message
    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    res.json({
      message: 'Message edited successfully',
      data: message
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/messages/:messageId
// @desc    Delete a message
// @access  Private
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findOne({
      _id: messageId,
      sender: req.user._id
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    await Message.findByIdAndDelete(messageId);

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
