const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const MemoryDB = require('./config/database-memory');

// Create a demo user for testing
const createDemoUser = () => {
  const demoUser = MemoryDB.createUser({
    name: 'WhatsApp Bot',
    email: 'bot@whatsapp-clone.com',
    password: 'demo123',
    avatar: '',
    status: 'I am a demo bot. Try messaging me!',
    isOnline: true
  });
  return demoUser;
};

// Initialize demo user
let demoUser = null;
setTimeout(() => {
  demoUser = createDemoUser();
  console.log('📱 Demo bot created for testing');
}, 1000);

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({ origin: ['http://localhost:3000'], credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auth middleware
const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token provided' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    const user = MemoryDB.findUserById(decoded.id);
    if (!user) return res.status(401).json({ message: 'Invalid token' });
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (MemoryDB.findUserByEmail(email)) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = MemoryDB.createUser({
      name,
      email,
      password: hashedPassword,
      avatar: '',
      status: 'Hey there! I am using WhatsApp Clone.',
      isOnline: true
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
    
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, status: user.status }
    });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = MemoryDB.findUserByEmail(email);
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    
    MemoryDB.updateUser(user._id, { isOnline: true, lastSeen: new Date() });
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, status: user.status, isOnline: true }
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = req.user;
  res.json({
    user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, status: user.status, isOnline: user.isOnline }
  });
});

app.get('/api/users', auth, (req, res) => {
  const users = MemoryDB.getAllUsers()
    .filter(u => u._id !== req.user._id)
    .map(u => ({ id: u._id, name: u.name, email: u.email, avatar: u.avatar, isOnline: u.isOnline }));
  res.json({ users });
});

app.put('/api/users/profile', auth, (req, res) => {
  try {
    const { name, status, avatar } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (status !== undefined) updateData.status = status;
    if (avatar !== undefined) updateData.avatar = avatar;

    const updatedUser = MemoryDB.updateUser(req.user._id, updateData);
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        status: updatedUser.status,
        isOnline: updatedUser.isOnline
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

app.get('/api/chats', auth, (req, res) => {
  const chats = MemoryDB.findChatsByUser(req.user._id).map(chat => {
    const participants = chat.participants.map(id => {
      const user = MemoryDB.findUserById(id);
      return user ? { _id: user._id, name: user.name, email: user.email, avatar: user.avatar, isOnline: user.isOnline } : null;
    }).filter(Boolean);
    
    const lastMessage = chat.lastMessage ? MemoryDB.findMessageById(chat.lastMessage) : null;
    
    return {
      ...chat,
      participants,
      lastMessage: lastMessage ? {
        _id: lastMessage._id,
        content: lastMessage.content,
        messageType: lastMessage.messageType,
        createdAt: lastMessage.createdAt
      } : null,
      unreadCount: 0
    };
  });
  
  res.json({ chats });
});

app.post('/api/chats', auth, (req, res) => {
  try {
    const { participantId } = req.body;
    
    if (!participantId || participantId === req.user._id) {
      return res.status(400).json({ message: 'Invalid participant' });
    }
    
    const participant = MemoryDB.findUserById(participantId);
    if (!participant) return res.status(404).json({ message: 'User not found' });
    
    // Check if chat exists
    const existingChats = MemoryDB.findChatsByUser(req.user._id);
    const existingChat = existingChats.find(chat => 
      !chat.isGroupChat && 
      chat.participants.length === 2 && 
      chat.participants.includes(participantId)
    );
    
    if (existingChat) {
      return res.json({ chat: existingChat });
    }
    
    const chat = MemoryDB.createChat({
      participants: [req.user._id, participantId],
      isGroupChat: false
    });
    
    res.status(201).json({ message: 'Chat created', chat });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create chat' });
  }
});

app.get('/api/messages/:chatId', auth, (req, res) => {
  try {
    const { chatId } = req.params;
    
    const chat = MemoryDB.findChatById(chatId);
    if (!chat || !chat.participants.includes(req.user._id)) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    const messages = MemoryDB.findMessagesByChat(chatId).map(msg => {
      const sender = MemoryDB.findUserById(msg.sender);
      return {
        ...msg,
        sender: sender ? { _id: sender._id, name: sender.name, avatar: sender.avatar } : null
      };
    });
    
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load messages' });
  }
});

// Socket.io
const activeUsers = new Map();

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    const user = MemoryDB.findUserById(decoded.id);
    if (!user) return next(new Error('Invalid token'));
    
    socket.userId = user._id;
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Auth failed'));
  }
});

io.on('connection', (socket) => {
  console.log(`User ${socket.user.name} connected`);
  
  activeUsers.set(socket.userId, { socketId: socket.id, user: socket.user });
  MemoryDB.updateUser(socket.userId, { isOnline: true, socketId: socket.id });
  
  socket.on('join_chat', ({ chatId }) => {
    const chat = MemoryDB.findChatById(chatId);
    if (chat && chat.participants.includes(socket.userId)) {
      socket.join(chatId);
      socket.emit('joined_chat', { chatId });
    }
  });
  
  socket.on('send_message', async ({ content, chatId, tempId }) => {
    try {
      const chat = MemoryDB.findChatById(chatId);
      if (!chat || !chat.participants.includes(socket.userId)) return;
      
      const message = MemoryDB.createMessage({
        content,
        sender: socket.userId,
        chat: chatId,
        messageType: 'text',
        status: 'sent'
      });
      
      MemoryDB.updateChat(chatId, { lastMessage: message._id });
      
      const sender = MemoryDB.findUserById(socket.userId);
      const messageWithSender = {
        ...message,
        sender: { _id: sender._id, name: sender.name, avatar: sender.avatar }
      };
      
      io.to(chatId).emit('new_message', { message: messageWithSender, chatId });
      socket.emit('message_sent', { messageId: message._id, tempId });

      // Auto-reply from demo bot
      if (demoUser && chat.participants.includes(demoUser._id) && socket.userId !== demoUser._id) {
        setTimeout(() => {
          const responses = [
            "Hello! I'm the WhatsApp Clone demo bot 🤖",
            "Thanks for trying out this messaging app!",
            "This is a real-time message. Pretty cool, right? ✨",
            "You can also try sending files, images, and more!",
            "Feel free to create more users and test group chats 👥"
          ];
          const randomResponse = responses[Math.floor(Math.random() * responses.length)];
          
          const botMessage = MemoryDB.createMessage({
            content: randomResponse,
            sender: demoUser._id,
            chat: chatId,
            messageType: 'text',
            status: 'sent'
          });
          
          MemoryDB.updateChat(chatId, { lastMessage: botMessage._id });
          
          const botMessageWithSender = {
            ...botMessage,
            sender: { _id: demoUser._id, name: demoUser.name, avatar: demoUser.avatar }
          };
          
          io.to(chatId).emit('new_message', { message: botMessageWithSender, chatId });
        }, 1000 + Math.random() * 2000); // Random delay between 1-3 seconds
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
  
  socket.on('typing_start', ({ chatId }) => {
    socket.to(chatId).emit('user_typing', {
      userId: socket.userId,
      user: { name: socket.user.name },
      chatId
    });
  });

  socket.on('typing_stop', ({ chatId }) => {
    socket.to(chatId).emit('user_stop_typing', {
      userId: socket.userId,
      chatId
    });
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.user.name} disconnected`);
    activeUsers.delete(socket.userId);
    MemoryDB.updateUser(socket.userId, { isOnline: false, lastSeen: new Date() });
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Socket.io server ready`);
  console.log(`💾 Using in-memory database`);
});
