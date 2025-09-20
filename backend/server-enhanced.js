const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import enhanced routes and services
const authRoutes = require('./routes/authEnhanced');
const userRoutes = require('./routes/usersEnhanced');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');
const socketHandler = require('./socket/socketHandler');

// For development, we'll use the in-memory database
// In production, uncomment the line below and comment out the MemoryDB import
// const connectDB = require('./config/database');
const MemoryDB = require('./config/database-memory');

// Connect to database
// connectDB(); // Uncomment for MongoDB
console.log('📊 Using in-memory database for development');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: { message: 'Too many requests from this IP' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', globalLimiter);

// CORS with credentials support
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: true
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'WhatsApp Clone API',
    version: '2.0.0',
    description: 'Enhanced real-time messaging API with phone authentication',
    endpoints: {
      authentication: {
        'POST /api/auth/send-otp': 'Send OTP to phone number',
        'POST /api/auth/verify-otp': 'Verify OTP and login/register',
        'POST /api/auth/resend-otp': 'Resend OTP',
        'POST /api/auth/register-with-password': 'Register with email/password',
        'POST /api/auth/login-with-password': 'Login with email/password',
        'POST /api/auth/refresh-token': 'Refresh access token',
        'GET /api/auth/me': 'Get current user',
        'POST /api/auth/logout': 'Logout',
        'POST /api/auth/logout-all': 'Logout from all devices'
      },
      users: {
        'GET /api/users/search': 'Search users',
        'GET /api/users': 'Get all users (paginated)',
        'GET /api/users/:id': 'Get user by ID',
        'PUT /api/users/profile': 'Update profile',
        'POST /api/users/avatar': 'Upload avatar',
        'DELETE /api/users/avatar': 'Delete avatar',
        'POST /api/users/avatar/initials': 'Generate initials avatar',
        'PUT /api/users/status': 'Update online status',
        'PUT /api/users/preferences': 'Update preferences',
        'POST /api/users/block/:userId': 'Block user',
        'DELETE /api/users/block/:userId': 'Unblock user',
        'GET /api/users/blocked': 'Get blocked users'
      },
      chats: {
        'GET /api/chats': 'Get user chats',
        'POST /api/chats': 'Create one-on-one chat',
        'POST /api/chats/group': 'Create group chat',
        'GET /api/chats/:id': 'Get specific chat',
        'PUT /api/chats/:id': 'Update group chat',
        'POST /api/chats/:id/participants': 'Add participants',
        'DELETE /api/chats/:id/participants/:participantId': 'Remove participant'
      },
      messages: {
        'GET /api/messages/:chatId': 'Get messages for chat',
        'POST /api/messages': 'Send text message',
        'POST /api/messages/file': 'Send file message',
        'PUT /api/messages/:messageId/status': 'Update message status',
        'PUT /api/messages/:messageId': 'Edit message',
        'DELETE /api/messages/:messageId': 'Delete message'
      }
    },
    features: [
      'Phone number authentication with OTP',
      'Email/password authentication',
      'JWT token management with refresh tokens',
      'Avatar upload with image processing',
      'Real-time messaging with Socket.io',
      'File sharing with multiple formats',
      'User privacy settings',
      'Message status tracking',
      'Typing indicators',
      'Online/offline status',
      'User blocking/unblocking',
      'Rate limiting and security'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large' });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ message: 'Unexpected field' });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expired' });
  }
  
  // Validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ message: errors.join(', ') });
  }
  
  // Default error
  res.status(err.status || 500).json({ 
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    availableRoutes: ['/api/health', '/api/docs', '/api/auth', '/api/users', '/api/chats', '/api/messages']
  });
});

// Enhanced Socket.io connection handling
socketHandler(io);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('🚀 Enhanced WhatsApp Clone Server Started');
  console.log(`📱 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 Socket.io server ready for connections`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('✨ New Features:');
  console.log('  • Phone number authentication with OTP');
  console.log('  • Avatar upload with image processing');
  console.log('  • Enhanced user profiles and preferences');
  console.log('  • JWT token management with refresh tokens');
  console.log('  • User privacy settings');
  console.log('  • User blocking/unblocking');
  console.log('  • Enhanced security and rate limiting');
});

module.exports = { app, server, io };
