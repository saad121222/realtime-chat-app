const express = require('express');
const rateLimit = require('express-rate-limit');
const Chat = require('../models/ChatEnhanced');
const User = require('../models/UserEnhanced');
const Message = require('../models/MessageEnhanced');
const { auth } = require('../middleware/authEnhanced');
const { getIO } = require('../socket/socketManager');

const router = express.Router();

// Rate limiting for chat operations
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 chat operations per windowMs
  message: { message: 'Too many chat operations, please try again later' },
});

// @route   GET /api/chats
// @desc    Get user's chats with pagination
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      includeArchived = false,
      chatType = null 
    } = req.query;

    const chats = await Chat.findChatsForUser(req.user._id, {
      page: parseInt(page),
      limit: parseInt(limit),
      includeArchived: includeArchived === 'true',
      chatType
    });

    // Process chats to add additional info
    const processedChats = chats.map(chat => {
      const chatObj = chat;
      
      // For direct chats, get the other participant's info
      if (chatObj.chatType === 'direct') {
        const otherParticipant = chatObj.participantUsers.find(
          user => user._id.toString() !== req.user._id.toString()
        );
        
        if (otherParticipant) {
          chatObj.name = otherParticipant.name;
          chatObj.avatar = otherParticipant.avatar;
          chatObj.isOnline = otherParticipant.isOnline;
          chatObj.lastSeen = otherParticipant.lastSeen;
        }
      }

      // Add unread count
      chatObj.unreadCount = 0; // Will be calculated separately for performance
      
      // Add last message info
      if (chatObj.lastMessageData && chatObj.lastMessageData.length > 0) {
        chatObj.lastMessage = chatObj.lastMessageData[0];
      }

      return chatObj;
    });

    res.json({
      chats: processedChats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: processedChats.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ message: 'Failed to fetch chats' });
  }
});

// @route   POST /api/chats
// @desc    Create a direct chat
// @access  Private
router.post('/', [auth, chatLimiter], async (req, res) => {
  try {
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ message: 'Participant ID is required' });
    }

    if (participantId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot create chat with yourself' });
    }

    // Check if participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create or get existing direct chat
    const chat = await Chat.createDirectChat(req.user._id, participantId);

    // Populate chat data
    await chat.populate([
      { path: 'participants.user', select: 'name avatar phoneNumber isOnline lastSeen' },
      { path: 'lastMessage', select: 'content messageType createdAt sender' }
    ]);

    // Process chat for response
    const chatObj = chat.toObject();
    const otherParticipant = chatObj.participants.find(
      p => p.user._id.toString() !== req.user._id.toString()
    );

    if (otherParticipant) {
      chatObj.name = otherParticipant.user.name;
      chatObj.avatar = otherParticipant.user.avatar;
      chatObj.isOnline = otherParticipant.user.isOnline;
      chatObj.lastSeen = otherParticipant.user.lastSeen;
    }

    // Emit chat creation to participants
    const io = getIO();
    if (io) {
      // Join both users to the chat room
      io.to(`user_${req.user._id}`).emit('chat_created', { chat: chatObj });
      io.to(`user_${participantId}`).emit('chat_created', { chat: chatObj });
    }

    res.status(201).json({
      message: 'Chat created successfully',
      chat: chatObj
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ message: 'Failed to create chat' });
  }
});

// @route   POST /api/chats/group
// @desc    Create a group chat
// @access  Private
router.post('/group', [auth, chatLimiter], async (req, res) => {
  try {
    const { name, description, participantIds = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    if (participantIds.length < 1) {
      return res.status(400).json({ message: 'At least one participant is required' });
    }

    if (participantIds.length > 256) {
      return res.status(400).json({ message: 'Maximum 256 participants allowed' });
    }

    // Verify all participants exist
    const participants = await User.find({ _id: { $in: participantIds } });
    if (participants.length !== participantIds.length) {
      return res.status(400).json({ message: 'Some participants not found' });
    }

    // Create group chat
    const chat = new Chat({
      name: name.trim(),
      description: description?.trim() || '',
      chatType: 'group',
      participants: [
        { user: req.user._id, role: 'owner', isActive: true },
        ...participantIds.map(id => ({ user: id, role: 'member', isActive: true }))
      ]
    });

    await chat.save();

    // Populate chat data
    await chat.populate([
      { path: 'participants.user', select: 'name avatar phoneNumber' }
    ]);

    // Emit group creation to all participants
    const io = getIO();
    if (io) {
      const allParticipants = [req.user._id, ...participantIds];
      allParticipants.forEach(userId => {
        io.to(`user_${userId}`).emit('group_created', { 
          chat: chat.toObject() 
        });
      });
    }

    res.status(201).json({
      message: 'Group chat created successfully',
      chat: chat.toObject()
    });
  } catch (error) {
    console.error('Create group chat error:', error);
    res.status(500).json({ message: 'Failed to create group chat' });
  }
});

// @route   GET /api/chats/:chatId
// @desc    Get specific chat details
// @access  Private
router.get('/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId)
      .populate('participants.user', 'name avatar phoneNumber isOnline lastSeen')
      .populate('lastMessage', 'content messageType createdAt sender')
      .populate('pinnedMessages.message', 'content messageType createdAt sender')
      .populate('pinnedMessages.pinnedBy', 'name');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Verify user is participant
    if (!chat.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Process chat data
    const chatObj = chat.toObject();

    // For direct chats, set name and avatar from other participant
    if (chat.isDirect) {
      const otherParticipant = chatObj.participants.find(
        p => p.user._id.toString() !== req.user._id.toString()
      );

      if (otherParticipant) {
        chatObj.name = otherParticipant.user.name;
        chatObj.avatar = otherParticipant.user.avatar;
        chatObj.isOnline = otherParticipant.user.isOnline;
        chatObj.lastSeen = otherParticipant.user.lastSeen;
      }
    }

    // Get unread message count
    chatObj.unreadCount = await Message.getUnreadCount(req.user._id, chatId);

    res.json({ chat: chatObj });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ message: 'Failed to fetch chat' });
  }
});

// @route   PUT /api/chats/:chatId
// @desc    Update group chat details
// @access  Private
router.put('/:chatId', [auth, chatLimiter], async (req, res) => {
  try {
    const { chatId } = req.params;
    const { name, description, settings } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Only group chats can be updated
    if (!chat.isGroup) {
      return res.status(400).json({ message: 'Cannot update direct chat' });
    }

    // Check permissions
    if (!chat.isAdmin(req.user._id)) {
      return res.status(403).json({ message: 'Only admins can update group details' });
    }

    // Update fields
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: 'Group name cannot be empty' });
      }
      chat.name = name.trim();
    }

    if (description !== undefined) {
      chat.description = description.trim();
    }

    if (settings !== undefined) {
      chat.settings = { ...chat.settings, ...settings };
    }

    await chat.save();

    // Emit group update to participants
    const io = getIO();
    if (io) {
      io.to(`chat_${chatId}`).emit('group_updated', {
        chatId,
        updates: { name, description, settings },
        updatedBy: req.user._id
      });
    }

    res.json({
      message: 'Group updated successfully',
      chat: chat.toObject()
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ message: 'Failed to update group' });
  }
});

// @route   POST /api/chats/:chatId/participants
// @desc    Add participants to group chat
// @access  Private
router.post('/:chatId/participants', [auth, chatLimiter], async (req, res) => {
  try {
    const { chatId } = req.params;
    const { participantIds } = req.body;

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ message: 'Participant IDs are required' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.isGroup) {
      return res.status(400).json({ message: 'Cannot add participants to direct chat' });
    }

    // Check permissions
    const canAdd = chat.isAdmin(req.user._id) || 
                   chat.settings.addParticipantsPermission === 'all';

    if (!canAdd) {
      return res.status(403).json({ message: 'Insufficient permissions to add participants' });
    }

    // Verify participants exist
    const users = await User.find({ _id: { $in: participantIds } });
    if (users.length !== participantIds.length) {
      return res.status(400).json({ message: 'Some users not found' });
    }

    // Add participants
    const addedUsers = [];
    for (const userId of participantIds) {
      if (!chat.isParticipant(userId)) {
        await chat.addParticipant(userId);
        addedUsers.push(userId);
      }
    }

    await chat.populate('participants.user', 'name avatar phoneNumber');

    // Emit participant addition
    const io = getIO();
    if (io) {
      // Notify existing participants
      io.to(`chat_${chatId}`).emit('participants_added', {
        chatId,
        addedUsers,
        addedBy: req.user._id
      });

      // Notify new participants
      addedUsers.forEach(userId => {
        io.to(`user_${userId}`).emit('added_to_group', {
          chat: chat.toObject(),
          addedBy: req.user._id
        });
      });
    }

    res.json({
      message: 'Participants added successfully',
      addedCount: addedUsers.length
    });
  } catch (error) {
    console.error('Add participants error:', error);
    res.status(500).json({ message: 'Failed to add participants' });
  }
});

// @route   DELETE /api/chats/:chatId/participants/:participantId
// @desc    Remove participant from group chat
// @access  Private
router.delete('/:chatId/participants/:participantId', [auth, chatLimiter], async (req, res) => {
  try {
    const { chatId, participantId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.isGroup) {
      return res.status(400).json({ message: 'Cannot remove participants from direct chat' });
    }

    // Check permissions
    const isAdmin = chat.isAdmin(req.user._id);
    const isSelf = participantId === req.user._id.toString();

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    // Cannot remove owner unless they're removing themselves
    const participant = chat.getParticipant(participantId);
    if (participant && participant.role === 'owner' && !isSelf) {
      return res.status(400).json({ message: 'Cannot remove group owner' });
    }

    // Remove participant
    await chat.removeParticipant(participantId);

    // Emit participant removal
    const io = getIO();
    if (io) {
      io.to(`chat_${chatId}`).emit('participant_removed', {
        chatId,
        removedUser: participantId,
        removedBy: req.user._id
      });

      io.to(`user_${participantId}`).emit('removed_from_group', {
        chatId,
        removedBy: req.user._id
      });
    }

    res.json({ message: 'Participant removed successfully' });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ message: 'Failed to remove participant' });
  }
});

// @route   POST /api/chats/:chatId/archive
// @desc    Archive chat for user
// @access  Private
router.post('/:chatId/archive', auth, async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await chat.archiveForUser(req.user._id);

    res.json({ message: 'Chat archived successfully' });
  } catch (error) {
    console.error('Archive chat error:', error);
    res.status(500).json({ message: 'Failed to archive chat' });
  }
});

// @route   DELETE /api/chats/:chatId/archive
// @desc    Unarchive chat for user
// @access  Private
router.delete('/:chatId/archive', auth, async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await chat.unarchiveForUser(req.user._id);

    res.json({ message: 'Chat unarchived successfully' });
  } catch (error) {
    console.error('Unarchive chat error:', error);
    res.status(500).json({ message: 'Failed to unarchive chat' });
  }
});

// @route   POST /api/chats/:chatId/typing
// @desc    Set typing indicator
// @access  Private
router.post('/:chatId/typing', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { isTyping } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    if (!chat.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update typing indicator
    if (isTyping) {
      await chat.addTypingUser(req.user._id);
    } else {
      await chat.removeTypingUser(req.user._id);
    }

    // Emit typing indicator to other participants
    const io = getIO();
    if (io) {
      const eventName = isTyping ? 'user_typing' : 'user_stop_typing';
      io.to(`chat_${chatId}`).emit(eventName, {
        userId: req.user._id,
        user: {
          name: req.user.name,
          avatar: req.user.avatar
        },
        chatId
      });
    }

    res.json({ message: 'Typing indicator updated' });
  } catch (error) {
    console.error('Update typing indicator error:', error);
    res.status(500).json({ message: 'Failed to update typing indicator' });
  }
});

module.exports = router;
