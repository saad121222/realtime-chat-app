const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/UserEnhanced');
const { auth } = require('../middleware/authEnhanced');
const avatarService = require('../services/avatarService');

const router = express.Router();

// Rate limiting for profile updates
const profileUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 profile updates per windowMs
  message: { message: 'Too many profile update attempts, please try again later' },
});

// Configure multer for avatar uploads
const upload = avatarService.getMulterConfig();

// @route   GET /api/users/search
// @desc    Search users by name or phone number
// @access  Private
router.get('/search', auth, async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const users = await User.searchUsers(query.trim(), req.user._id, parseInt(limit));

    res.json({ 
      users: users.map(user => user.toSafeObject()),
      count: users.length
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Search failed' });
  }
});

// @route   GET /api/users
// @desc    Get all users (paginated)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, online } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = { _id: { $ne: req.user._id } };
    
    // Filter by online status if specified
    if (online !== undefined) {
      query.isOnline = online === 'true';
    }

    const users = await User.find(query)
      .select('name phoneNumber avatar status isOnline lastSeen')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ name: 1 });

    const total = await User.countDocuments(query);

    res.json({ 
      users: users.map(user => user.toSafeObject()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name phoneNumber avatar status isOnline lastSeen preferences.privacy');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Apply privacy settings
    const userObject = user.toSafeObject();
    const privacy = user.preferences?.privacy;

    if (privacy) {
      // Check privacy settings and filter data accordingly
      if (privacy.profilePhoto === 'nobody' || 
          (privacy.profilePhoto === 'contacts' && !user.isContact)) {
        userObject.avatar = '';
        userObject.avatarUrl = '';
      }

      if (privacy.status === 'nobody' || 
          (privacy.status === 'contacts' && !user.isContact)) {
        userObject.status = '';
      }

      if (privacy.lastSeen === 'nobody' || 
          (privacy.lastSeen === 'contacts' && !user.isContact)) {
        userObject.lastSeen = null;
        userObject.isOnline = false;
      }
    }

    res.json({ user: userObject });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [auth, profileUpdateLimiter], async (req, res) => {
  try {
    const { name, status, email, preferences } = req.body;
    
    const updateData = {};
    
    if (name !== undefined) {
      if (!name.trim() || name.trim().length < 2) {
        return res.status(400).json({ message: 'Name must be at least 2 characters' });
      }
      updateData.name = name.trim();
    }
    
    if (status !== undefined) {
      if (status.length > 500) {
        return res.status(400).json({ message: 'Status cannot be more than 500 characters' });
      }
      updateData.status = status;
    }
    
    if (email !== undefined) {
      if (email && !email.includes('@')) {
        return res.status(400).json({ message: 'Please provide a valid email' });
      }
      updateData.email = email.toLowerCase();
    }

    if (preferences !== undefined) {
      updateData.preferences = { ...req.user.preferences, ...preferences };
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Profile updated successfully',
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: errors.join(', ') });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: 'Profile update failed' });
  }
});

// @route   POST /api/users/avatar
// @desc    Upload user avatar
// @access  Private
router.post('/avatar', [auth, profileUpdateLimiter], (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    try {
      if (err) {
        return res.status(400).json({ message: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }

      // Validate image
      await avatarService.validateImage(req.file.buffer);

      // Get current user to delete old avatar
      const currentUser = await User.findById(req.user._id);
      const oldAvatar = currentUser.avatar;

      // Process and save new avatar
      const result = await avatarService.processAvatar(req.file.buffer, req.user._id);

      if (!result.success) {
        return res.status(500).json({ message: 'Failed to process avatar' });
      }

      // Update user with new avatar
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { avatar: result.filename },
        { new: true }
      );

      // Delete old avatar file (if exists and different)
      if (oldAvatar && oldAvatar !== result.filename) {
        avatarService.deleteAvatar(oldAvatar);
      }

      res.json({
        message: 'Avatar uploaded successfully',
        avatar: result.url,
        user: user.toSafeObject()
      });
    } catch (error) {
      console.error('Avatar upload error:', error);
      res.status(500).json({ message: error.message || 'Avatar upload failed' });
    }
  });
});

// @route   DELETE /api/users/avatar
// @desc    Delete user avatar
// @access  Private
router.delete('/avatar', [auth, profileUpdateLimiter], async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const oldAvatar = user.avatar;

    // Remove avatar from user
    user.avatar = '';
    await user.save();

    // Delete avatar file
    if (oldAvatar) {
      avatarService.deleteAvatar(oldAvatar);
    }

    res.json({
      message: 'Avatar deleted successfully',
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('Avatar delete error:', error);
    res.status(500).json({ message: 'Failed to delete avatar' });
  }
});

// @route   POST /api/users/avatar/initials
// @desc    Generate avatar from initials
// @access  Private
router.post('/avatar/initials', [auth, profileUpdateLimiter], async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2);
    const backgroundColor = avatarService.getAvatarColor(user.name);

    // Generate initials avatar
    const result = await avatarService.generateInitialsAvatar(initials, backgroundColor);

    if (!result.success) {
      return res.status(500).json({ message: 'Failed to generate avatar' });
    }

    // Delete old avatar
    const oldAvatar = user.avatar;
    if (oldAvatar) {
      avatarService.deleteAvatar(oldAvatar);
    }

    // Update user with new avatar
    user.avatar = result.filename;
    await user.save();

    res.json({
      message: 'Avatar generated successfully',
      avatar: result.url,
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('Generate avatar error:', error);
    res.status(500).json({ message: 'Failed to generate avatar' });
  }
});

// @route   PUT /api/users/status
// @desc    Update user online status
// @access  Private
router.put('/status', auth, async (req, res) => {
  try {
    const { isOnline, socketId } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        isOnline: isOnline !== undefined ? isOnline : true,
        lastSeen: new Date(),
        socketId: socketId || ''
      },
      { new: true }
    );

    res.json({
      message: 'Status updated successfully',
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Status update failed' });
  }
});

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', [auth, profileUpdateLimiter], async (req, res) => {
  try {
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ message: 'Invalid preferences data' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { preferences: { ...req.user.preferences, ...preferences } },
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Preferences updated successfully',
      preferences: user.preferences,
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'Preferences update failed' });
  }
});

// @route   POST /api/users/block/:userId
// @desc    Block a user
// @access  Private
router.post('/block/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    const userToBlock = await User.findById(userId);
    if (!userToBlock) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = await User.findById(req.user._id);
    
    if (!user.blockedUsers.includes(userId)) {
      user.blockedUsers.push(userId);
      await user.save();
    }

    res.json({
      message: 'User blocked successfully',
      blockedUsers: user.blockedUsers
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Failed to block user' });
  }
});

// @route   DELETE /api/users/block/:userId
// @desc    Unblock a user
// @access  Private
router.delete('/block/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(req.user._id);
    user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== userId);
    await user.save();

    res.json({
      message: 'User unblocked successfully',
      blockedUsers: user.blockedUsers
    });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ message: 'Failed to unblock user' });
  }
});

// @route   GET /api/users/blocked
// @desc    Get blocked users list
// @access  Private
router.get('/blocked', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'blockedUsers',
      select: 'name phoneNumber avatar'
    });

    res.json({
      blockedUsers: user.blockedUsers.map(u => u.toSafeObject())
    });
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ message: 'Failed to fetch blocked users' });
  }
});

module.exports = router;
