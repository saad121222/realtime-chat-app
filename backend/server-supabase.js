const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { supabase, testConnection } = require('./config/supabase');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');

// Production logging configuration
const isProduction = process.env.NODE_ENV === 'production';
const log = {
  info: (message, ...args) => {
    if (isProduction) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    } else {
      console.log(`🔵 ${message}`, ...args);
    }
  },
  error: (message, ...args) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  },
  success: (message, ...args) => {
    if (isProduction) {
      console.log(`[SUCCESS] ${new Date().toISOString()} - ${message}`, ...args);
    } else {
      console.log(`✅ ${message}`, ...args);
    }
  }
};

// Test Supabase connection
const initializeDatabase = async () => {
  try {
    await testConnection();
    log.success('Supabase connection established');
  } catch (error) {
    log.error('Failed to connect to Supabase:', error.message);
    if (isProduction) {
      process.exit(1);
    }
  }
};

initializeDatabase();

const app = express();
const server = http.createServer(app);

// Production CORS configuration
const getCorsOrigins = () => {
  if (isProduction) {
    const origins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
    log.info('Production CORS origins:', origins);
    return origins;
  }
  return ['http://localhost:3000', 'http://localhost:3001'];
};

const corsOrigins = getCorsOrigins();

const io = socketIo(server, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Security middleware with production configuration
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  } : false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting with environment-based configuration
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (isProduction ? 100 : 1000),
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === '/health' || req.path === '/api/health';
  }
});

app.use('/api/', limiter);

// CORS with production configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    log.warn('CORS blocked request from origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count']
}));

// Request logging middleware
app.use((req, res, next) => {
  if (isProduction) {
    log.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  }
  next();
});

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      log.error('Invalid JSON in request body:', e.message);
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Real-time Chat API Server with Supabase',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'Supabase PostgreSQL'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    database: 'Supabase PostgreSQL'
  });
});

// API health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    database: 'Supabase PostgreSQL'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

// Supabase Real-time Socket.io Integration
io.on('connection', (socket) => {
  log.info('User connected:', socket.id);

  // Join user to their personal room
  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
    log.info(`User ${userId} joined personal room`);
  });

  // Join chat room
  socket.on('join_chat', (chatId) => {
    socket.join(`chat_${chatId}`);
    log.info(`Socket ${socket.id} joined chat ${chatId}`);
  });

  // Leave chat room
  socket.on('leave_chat', (chatId) => {
    socket.leave(`chat_${chatId}`);
    log.info(`Socket ${socket.id} left chat ${chatId}`);
  });

  // Handle new message
  socket.on('send_message', async (data) => {
    try {
      const { chatId, senderId, content, messageType } = data;
      
      // Create message in Supabase
      const { data: message, error } = await supabase
        .from('messages')
        .insert([{
          chat_id: chatId,
          sender_id: senderId,
          content: content,
          message_type: messageType || 'text'
        }])
        .select(`
          *,
          sender:users!sender_id(id, username, avatar)
        `)
        .single();

      if (error) throw error;

      // Update chat's last message
      await supabase
        .from('chats')
        .update({
          last_message: content,
          last_message_time: message.created_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);

      // Emit to chat room
      io.to(`chat_${chatId}`).emit('new_message', message);
      
      log.info(`Message sent to chat ${chatId} by user ${senderId}`);
    } catch (error) {
      log.error('Error sending message:', error.message);
      socket.emit('message_error', { error: error.message });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    socket.to(`chat_${data.chatId}`).emit('user_typing', {
      userId: data.userId,
      username: data.username
    });
  });

  socket.on('typing_stop', (data) => {
    socket.to(`chat_${data.chatId}`).emit('user_stop_typing', {
      userId: data.userId
    });
  });

  // Handle user online status
  socket.on('user_online', async (userId) => {
    try {
      await supabase
        .from('users')
        .update({
          is_online: true,
          last_seen: new Date().toISOString()
        })
        .eq('id', userId);

      socket.broadcast.emit('user_status_change', {
        userId: userId,
        isOnline: true
      });
    } catch (error) {
      log.error('Error updating online status:', error.message);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    log.info('User disconnected:', socket.id);
    
    // Note: In a production app, you'd want to track which user this socket belongs to
    // and update their online status accordingly
  });
});

// Listen for Supabase real-time events
const setupSupabaseRealtime = () => {
  // Subscribe to message inserts
  const messageSubscription = supabase
    .channel('messages')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        log.info('New message from Supabase:', payload.new.id);
        // Additional real-time logic can be added here
      }
    )
    .subscribe();

  // Subscribe to user status changes
  const userSubscription = supabase
    .channel('users')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'users' },
      (payload) => {
        if (payload.new.is_online !== payload.old.is_online) {
          io.emit('user_status_change', {
            userId: payload.new.id,
            isOnline: payload.new.is_online
          });
        }
      }
    )
    .subscribe();

  log.success('Supabase real-time subscriptions established');
};

// Initialize Supabase real-time
setupSupabaseRealtime();

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  log.error('Server error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS policy violation',
      message: 'Origin not allowed'
    });
  }

  if (err.message === 'Invalid JSON') {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON'
    });
  }

  if (err.status === 429) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded'
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: isProduction ? 'Something went wrong!' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  log.warn('404 - Route not found:', req.originalUrl);
  res.status(404).json({ 
    error: 'Not Found',
    message: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Use Render's PORT or fallback to 5000 for local development
const PORT = process.env.PORT || 5000;

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  log.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      log.error('Error during server shutdown:', err);
      process.exit(1);
    }
    
    log.info('Server closed successfully');
    process.exit(0);
  });
  
  setTimeout(() => {
    log.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  log.error('Uncaught Exception:', err);
  if (isProduction) {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (isProduction) {
    process.exit(1);
  }
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  log.success(`Server running on port ${PORT}`);
  log.success('Socket.io server ready for connections');
  log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  log.info(`CORS Origins: ${corsOrigins.join(', ')}`);
  log.info('Database: Supabase PostgreSQL');
  
  if (isProduction) {
    log.info('Production mode: Enhanced security and logging enabled');
    log.info(`Health check available at: /health`);
    log.info(`API health check available at: /api/health`);
  }
});
