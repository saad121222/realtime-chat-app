const express = require('express');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/chats
// @desc    Get all chats for the current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id
    }).sort({ updatedAt: -1 });

    // Add unread message count for each chat
    const chatsWithUnreadCount = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.countDocuments({
          chat: chat._id,
          sender: { $ne: req.user._id },
          readBy: { $not: { $elemMatch: { user: req.user._id } } }
        });

        return {
          ...chat.toObject(),
          unreadCount
        };
      })
    );

    res.json({ chats: chatsWithUnreadCount });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/chats
// @desc    Create a new one-on-one chat
// @access  Private
router.post('/', auth, async (req, res) => {
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

    // Check if chat already exists
    const existingChat = await Chat.findOne({
      isGroupChat: false,
      participants: { $all: [req.user._id, participantId], $size: 2 }
    });

    if (existingChat) {
      return res.json({ chat: existingChat });
    }

    // Create new chat
    const chat = new Chat({
      participants: [req.user._id, participantId],
      isGroupChat: false
    });

    await chat.save();
    await chat.populate('participants', 'name email avatar isOnline lastSeen');

    res.status(201).json({
      message: 'Chat created successfully',
      chat
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/chats/group
// @desc    Create a new group chat
// @access  Private
router.post('/group', auth, async (req, res) => {
  try {
    const { name, participantIds, description } = req.body;

    if (!name || !participantIds || participantIds.length < 2) {
      return res.status(400).json({ 
        message: 'Group name and at least 2 participants are required' 
      });
    }

    // Verify all participants exist
    const participants = await User.find({ _id: { $in: participantIds } });
    if (participants.length !== participantIds.length) {
      return res.status(400).json({ message: 'Some participants not found' });
    }

    // Add current user as admin and participant
    const allParticipants = [req.user._id, ...participantIds.filter(id => id !== req.user._id.toString())];

    // Create group chat
    const chat = new Chat({
      name,
      description,
      participants: allParticipants,
      admin: req.user._id,
      isGroupChat: true
    });

    await chat.save();
    await chat.populate('participants', 'name email avatar isOnline lastSeen');
    await chat.populate('admin', 'name email avatar');

    res.status(201).json({
      message: 'Group chat created successfully',
      chat
    });
  } catch (error) {
    console.error('Create group chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/chats/:id
// @desc    Get a specific chat
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.json({ chat });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/chats/:id
// @desc    Update group chat details
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, groupAvatar } = req.body;

    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id,
      isGroupChat: true
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    // Check if user is admin
    if (chat.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only group admin can update group details' });
    }

    // Update fields
    if (name) chat.name = name;
    if (description !== undefined) chat.description = description;
    if (groupAvatar !== undefined) chat.groupAvatar = groupAvatar;

    await chat.save();

    res.json({
      message: 'Group chat updated successfully',
      chat
    });
  } catch (error) {
    console.error('Update group chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/chats/:id/participants
// @desc    Add participants to group chat
// @access  Private
router.post('/:id/participants', auth, async (req, res) => {
  try {
    const { participantIds } = req.body;

    if (!participantIds || participantIds.length === 0) {
      return res.status(400).json({ message: 'Participant IDs are required' });
    }

    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id,
      isGroupChat: true
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    // Check if user is admin
    if (chat.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only group admin can add participants' });
    }

    // Verify participants exist and are not already in the group
    const newParticipants = participantIds.filter(id => 
      !chat.participants.some(p => p.toString() === id)
    );

    if (newParticipants.length === 0) {
      return res.status(400).json({ message: 'All users are already in the group' });
    }

    const users = await User.find({ _id: { $in: newParticipants } });
    if (users.length !== newParticipants.length) {
      return res.status(400).json({ message: 'Some users not found' });
    }

    // Add participants
    chat.participants.push(...newParticipants);
    await chat.save();
    await chat.populate('participants', 'name email avatar isOnline lastSeen');

    res.json({
      message: 'Participants added successfully',
      chat
    });
  } catch (error) {
    console.error('Add participants error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/chats/:id/participants/:participantId
// @desc    Remove participant from group chat
// @access  Private
router.delete('/:id/participants/:participantId', auth, async (req, res) => {
  try {
    const { participantId } = req.params;

    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id,
      isGroupChat: true
    });

    if (!chat) {
      return res.status(404).json({ message: 'Group chat not found' });
    }

    // Check if user is admin or removing themselves
    if (chat.admin.toString() !== req.user._id.toString() && participantId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only group admin can remove participants' });
    }

    // Cannot remove admin
    if (participantId === chat.admin.toString()) {
      return res.status(400).json({ message: 'Cannot remove group admin' });
    }

    // Remove participant
    chat.participants = chat.participants.filter(p => p.toString() !== participantId);
    await chat.save();
    await chat.populate('participants', 'name email avatar isOnline lastSeen');

    res.json({
      message: 'Participant removed successfully',
      chat
    });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
