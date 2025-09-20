const jwt = require('jsonwebtoken');
const User = require('../models/UserEnhanced');
const Chat = require('../models/ChatEnhanced');
const Message = require('../models/MessageEnhanced');
const { setIO } = require('./socketManager');

// Store active connections
const activeConnections = new Map();
const userSockets = new Map(); // userId -> Set of socketIds
const typingTimeouts = new Map(); // socketId -> timeout

const socketHandler = (io) => {
  // Set the IO instance for use in other modules
  setIO(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      // Attach user to socket
      socket.user = user;
      socket.userId = user._id.toString();
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    const user = socket.user;

    console.log(`🔌 User ${user.name} connected (${socket.id})`);

    // Store connection
    activeConnections.set(socket.id, {
      userId,
      user,
      connectedAt: new Date()
    });

    // Track user sockets
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Join user to their personal room
    socket.join(`user_${userId}`);

    // Update user online status
    try {
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date(),
        socketId: socket.id
      });

      // Notify contacts about online status
      socket.broadcast.emit('user_online', {
        userId,
        user: {
          _id: user._id,
          name: user.name,
          avatar: user.avatar
        }
      });
    } catch (error) {
      console.error('Error updating user online status:', error);
    }

    // Join user to their chat rooms
    try {
      const userChats = await Chat.find({
        'participants.user': userId,
        'participants.isActive': true,
        isDeleted: false
      }).select('_id');

      userChats.forEach(chat => {
        socket.join(`chat_${chat._id}`);
      });

      console.log(`📱 User ${user.name} joined ${userChats.length} chat rooms`);
    } catch (error) {
      console.error('Error joining chat rooms:', error);
    }

    // Handle joining specific chat room
    socket.on('join_chat', async (data) => {
      try {
        const { chatId } = data;
        
        // Verify user is participant in chat
        const chat = await Chat.findById(chatId);
        if (chat && chat.isParticipant(userId)) {
          socket.join(`chat_${chatId}`);
          
          // Mark messages as delivered
          await Message.updateMany(
            {
              chat: chatId,
              sender: { $ne: userId },
              'deliveredTo.user': { $ne: userId }
            },
            {
              $push: {
                deliveredTo: {
                  user: userId,
                  deliveredAt: new Date()
                }
              }
            }
          );

          socket.emit('joined_chat', { chatId });
          console.log(`📨 User ${user.name} joined chat ${chatId}`);
        } else {
          socket.emit('error', { message: 'Access denied to chat' });
        }
      } catch (error) {
        console.error('Join chat error:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    // Handle leaving chat room
    socket.on('leave_chat', (data) => {
      const { chatId } = data;
      socket.leave(`chat_${chatId}`);
      socket.emit('left_chat', { chatId });
      console.log(`📤 User ${user.name} left chat ${chatId}`);
    });

    // Handle real-time message sending
    socket.on('send_message', async (data) => {
      try {
        const { content, chatId, messageType = 'text', replyTo = null, tempId } = data;

        // Validate input
        if (!content && messageType === 'text') {
          return socket.emit('message_error', { 
            tempId, 
            error: 'Message content is required' 
          });
        }

        if (!chatId) {
          return socket.emit('message_error', { 
            tempId, 
            error: 'Chat ID is required' 
          });
        }

        // Verify chat and permissions
        const chat = await Chat.findById(chatId);
        if (!chat) {
          return socket.emit('message_error', { 
            tempId, 
            error: 'Chat not found' 
          });
        }

        if (!chat.isParticipant(userId)) {
          return socket.emit('message_error', { 
            tempId, 
            error: 'Access denied' 
          });
        }

        // Check messaging permissions for groups
        if (chat.isGroup && chat.settings.messagingPermission === 'admins') {
          if (!chat.isAdmin(userId)) {
            return socket.emit('message_error', { 
              tempId, 
              error: 'Only admins can send messages in this group' 
            });
          }
        }

        // Create message
        const message = new Message({
          content: content?.trim(),
          sender: userId,
          chat: chatId,
          messageType,
          replyTo,
          status: 'sent'
        });

        await message.save();

        // Update chat's last message
        await chat.updateLastMessage(message._id);

        // Populate message data
        await message.populate([
          { path: 'sender', select: 'name avatar phoneNumber' },
          { path: 'replyTo', select: 'content sender messageType' }
        ]);

        // Emit to chat participants
        io.to(`chat_${chatId}`).emit('new_message', {
          message: message.toJSON(),
          chatId
        });

        // Confirm message sent to sender
        socket.emit('message_sent', { 
          messageId: message._id, 
          tempId,
          message: message.toJSON()
        });

        // Send push notification to offline users (implement as needed)
        const activeParticipants = chat.participants
          .filter(p => p.isActive && p.user.toString() !== userId)
          .map(p => p.user.toString());

        activeParticipants.forEach(participantId => {
          io.to(`user_${participantId}`).emit('message_notification', {
            message: message.toJSON(),
            chat: {
              _id: chat._id,
              name: chat.name || user.name,
              chatType: chat.chatType
            }
          });
        });

        console.log(`💬 Message sent by ${user.name} in chat ${chatId}`);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('message_error', { 
          tempId: data.tempId, 
          error: 'Failed to send message' 
        });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', async (data) => {
      try {
        const { chatId } = data;
        
        const chat = await Chat.findById(chatId);
        if (chat && chat.isParticipant(userId)) {
          // Clear existing timeout
          if (typingTimeouts.has(socket.id)) {
            clearTimeout(typingTimeouts.get(socket.id));
          }

          // Add typing indicator
          await chat.addTypingUser(userId);

          // Emit to other participants
          socket.to(`chat_${chatId}`).emit('user_typing', {
            userId,
            user: {
              name: user.name,
              avatar: user.avatar
            },
            chatId
          });

          // Set timeout to auto-remove typing indicator
          const timeout = setTimeout(async () => {
            try {
              await chat.removeTypingUser(userId);
              socket.to(`chat_${chatId}`).emit('user_stop_typing', {
                userId,
                chatId
              });
              typingTimeouts.delete(socket.id);
            } catch (error) {
              console.error('Auto-remove typing error:', error);
            }
          }, 10000); // 10 seconds timeout

          typingTimeouts.set(socket.id, timeout);
        }
      } catch (error) {
        console.error('Typing start error:', error);
      }
    });

    socket.on('typing_stop', async (data) => {
      try {
        const { chatId } = data;
        
        // Clear timeout
        if (typingTimeouts.has(socket.id)) {
          clearTimeout(typingTimeouts.get(socket.id));
          typingTimeouts.delete(socket.id);
        }

        const chat = await Chat.findById(chatId);
        if (chat && chat.isParticipant(userId)) {
          await chat.removeTypingUser(userId);

          socket.to(`chat_${chatId}`).emit('user_stop_typing', {
            userId,
            chatId
          });
        }
      } catch (error) {
        console.error('Typing stop error:', error);
      }
    });

    // Handle message status updates
    socket.on('message_delivered', async (data) => {
      try {
        const { messageId, chatId } = data;
        
        const message = await Message.findById(messageId);
        if (message && message.sender.toString() !== userId) {
          await message.markAsDelivered(userId);
          
          // Notify sender
          io.to(`user_${message.sender}`).emit('message_status_update', {
            messageId,
            status: 'delivered',
            userId,
            chatId
          });
        }
      } catch (error) {
        console.error('Message delivered error:', error);
      }
    });

    socket.on('message_read', async (data) => {
      try {
        const { messageId, chatId } = data;
        
        const message = await Message.findById(messageId);
        if (message && message.sender.toString() !== userId) {
          await message.markAsRead(userId);
          
          // Notify sender
          io.to(`user_${message.sender}`).emit('message_status_update', {
            messageId,
            status: 'read',
            userId,
            chatId
          });
        }
      } catch (error) {
        console.error('Message read error:', error);
      }
    });

    // Handle message reactions
    socket.on('add_reaction', async (data) => {
      try {
        const { messageId, emoji, chatId } = data;
        
        const message = await Message.findById(messageId);
        if (message) {
          await message.addReaction(userId, emoji);
          
          io.to(`chat_${chatId}`).emit('message_reaction', {
            messageId,
            reaction: {
              user: {
                _id: userId,
                name: user.name,
                avatar: user.avatar
              },
              emoji,
              createdAt: new Date()
            },
            chatId
          });
        }
      } catch (error) {
        console.error('Add reaction error:', error);
      }
    });

    socket.on('remove_reaction', async (data) => {
      try {
        const { messageId, chatId } = data;
        
        const message = await Message.findById(messageId);
        if (message) {
          await message.removeReaction(userId);
          
          io.to(`chat_${chatId}`).emit('message_reaction_removed', {
            messageId,
            userId,
            chatId
          });
        }
      } catch (error) {
        console.error('Remove reaction error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`🔌 User ${user.name} disconnected (${socket.id})`);

      // Clean up connections
      activeConnections.delete(socket.id);
      
      if (userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id);
        if (userSockets.get(userId).size === 0) {
          userSockets.delete(userId);
        }
      }

      // Clear typing timeout
      if (typingTimeouts.has(socket.id)) {
        clearTimeout(typingTimeouts.get(socket.id));
        typingTimeouts.delete(socket.id);
      }

      // Update user offline status only if no other connections
      if (!userSockets.has(userId)) {
        try {
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
            socketId: ''
          });

          // Notify contacts about offline status
          socket.broadcast.emit('user_offline', {
            userId,
            lastSeen: new Date()
          });

          // Remove from all typing indicators
          await Chat.updateMany(
            { 'currentlyTyping.user': userId },
            { $pull: { currentlyTyping: { user: userId } } }
          );

        } catch (error) {
          console.error('Error updating user offline status:', error);
        }
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${user.name}:`, error);
    });
  });

  // Cleanup function to remove old typing indicators
  setInterval(async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      await Chat.updateMany(
        { 'currentlyTyping.startedAt': { $lt: fiveMinutesAgo } },
        { $pull: { currentlyTyping: { startedAt: { $lt: fiveMinutesAgo } } } }
      );
    } catch (error) {
      console.error('Cleanup typing indicators error:', error);
    }
  }, 60000); // Run every minute

  console.log('🚀 Enhanced Socket.io handler initialized');
};

module.exports = socketHandler;
