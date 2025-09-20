const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Chat = require('../models/Chat');

// Store active connections
const activeUsers = new Map();

const socketHandler = (io) => {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`👤 User ${socket.user.name} connected: ${socket.id}`);

    // Store user connection
    activeUsers.set(socket.userId, {
      socketId: socket.id,
      user: socket.user,
      lastSeen: new Date()
    });

    // Update user online status
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      socketId: socket.id,
      lastSeen: new Date()
    });

    // Notify other users that this user is online
    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      user: {
        id: socket.user._id,
        name: socket.user.name,
        avatar: socket.user.avatar
      }
    });

    // Join user to their chat rooms
    try {
      const userChats = await Chat.find({ participants: socket.userId });
      userChats.forEach(chat => {
        socket.join(chat._id.toString());
      });
      console.log(`📱 User ${socket.user.name} joined ${userChats.length} chat rooms`);
    } catch (error) {
      console.error('Error joining chat rooms:', error);
    }

    // Handle joining a specific chat
    socket.on('join_chat', async (data) => {
      try {
        const { chatId } = data;
        
        // Verify user is part of the chat
        const chat = await Chat.findOne({
          _id: chatId,
          participants: socket.userId
        });

        if (chat) {
          socket.join(chatId);
          console.log(`💬 User ${socket.user.name} joined chat: ${chatId}`);
          
          // Send confirmation
          socket.emit('joined_chat', { chatId });
        } else {
          socket.emit('error', { message: 'Chat not found or access denied' });
        }
      } catch (error) {
        console.error('Join chat error:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { content, chatId, messageType = 'text', replyTo } = data;

        // Verify user is part of the chat
        const chat = await Chat.findOne({
          _id: chatId,
          participants: socket.userId
        });

        if (!chat) {
          socket.emit('error', { message: 'Chat not found or access denied' });
          return;
        }

        // Create message
        const messageData = {
          content,
          sender: socket.userId,
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

        // Send message to all participants in the chat
        io.to(chatId).emit('new_message', {
          message: message,
          chatId: chatId
        });

        // Send delivery confirmation to sender
        socket.emit('message_sent', {
          messageId: message._id,
          tempId: data.tempId // For client-side message matching
        });

        console.log(`📨 Message sent in chat ${chatId} by ${socket.user.name}`);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle message status updates
    socket.on('message_delivered', async (data) => {
      try {
        const { messageId, chatId } = data;

        const message = await Message.findById(messageId);
        if (!message) return;

        // Don't update delivery status for own messages
        if (message.sender.toString() === socket.userId) return;

        // Update delivery status
        if (!message.deliveredTo.some(d => d.user.toString() === socket.userId)) {
          message.deliveredTo.push({ user: socket.userId });
          if (message.status === 'sent') {
            message.status = 'delivered';
          }
          await message.save();

          // Notify sender about delivery
          const senderConnection = activeUsers.get(message.sender.toString());
          if (senderConnection) {
            io.to(senderConnection.socketId).emit('message_status_update', {
              messageId: message._id,
              status: 'delivered',
              userId: socket.userId,
              chatId: chatId
            });
          }
        }
      } catch (error) {
        console.error('Message delivered error:', error);
      }
    });

    socket.on('message_read', async (data) => {
      try {
        const { messageId, chatId } = data;

        const message = await Message.findById(messageId);
        if (!message) return;

        // Don't update read status for own messages
        if (message.sender.toString() === socket.userId) return;

        // Update read status
        if (!message.readBy.some(r => r.user.toString() === socket.userId)) {
          message.readBy.push({ user: socket.userId });
          message.status = 'read';
          await message.save();

          // Notify sender about read status
          const senderConnection = activeUsers.get(message.sender.toString());
          if (senderConnection) {
            io.to(senderConnection.socketId).emit('message_status_update', {
              messageId: message._id,
              status: 'read',
              userId: socket.userId,
              chatId: chatId
            });
          }
        }
      } catch (error) {
        console.error('Message read error:', error);
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { chatId } = data;
      socket.to(chatId).emit('user_typing', {
        userId: socket.userId,
        user: {
          id: socket.user._id,
          name: socket.user.name
        },
        chatId: chatId
      });
    });

    socket.on('typing_stop', (data) => {
      const { chatId } = data;
      socket.to(chatId).emit('user_stop_typing', {
        userId: socket.userId,
        chatId: chatId
      });
    });

    // Handle user leaving a chat
    socket.on('leave_chat', (data) => {
      const { chatId } = data;
      socket.leave(chatId);
      console.log(`👋 User ${socket.user.name} left chat: ${chatId}`);
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`👤 User ${socket.user.name} disconnected: ${socket.id}`);

      // Remove from active users
      activeUsers.delete(socket.userId);

      // Update user offline status
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date(),
        socketId: ''
      });

      // Notify other users that this user is offline
      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
        user: {
          id: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar
        },
        lastSeen: new Date()
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Periodic cleanup of inactive connections
  setInterval(() => {
    const now = new Date();
    for (const [userId, connection] of activeUsers.entries()) {
      if (now - connection.lastSeen > 5 * 60 * 1000) { // 5 minutes
        activeUsers.delete(userId);
        console.log(`🧹 Cleaned up inactive connection for user: ${userId}`);
      }
    }
  }, 60000); // Run every minute
};

module.exports = socketHandler;
