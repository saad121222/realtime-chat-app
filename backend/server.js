const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');
const socketHandler = require('./socket/socketHandler');

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

// Connect to MongoDB with error handling
const initializeDatabase = async () => {
  try {
    await connectDB();
    log.success('Database connection established');
  } catch (error) {
    log.error('Failed to connect to database:', error.message);
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
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (isProduction ? 100 : 1000),
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

app.use('/api/', limiter);

// CORS with production configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
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

// Root health check endpoint (for Render)
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Real-time Chat API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
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
    environment: process.env.NODE_ENV || 'development'
  });
});

// API health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  // Log error details
  log.error('Server error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS policy violation',
      message: 'Origin not allowed'
    });
  }

  // JSON parsing error
  if (err.message === 'Invalid JSON') {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON'
    });
  }

  // Rate limiting error
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded'
    });
  }

  // Default error response
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

// Socket.io connection handling with error handling
try {
  socketHandler(io);
  log.success('Socket.io handlers initialized');
} catch (error) {
  log.error('Failed to initialize Socket.io handlers:', error.message);
}

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
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    log.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  log.error('Uncaught Exception:', err);
  if (isProduction) {
    process.exit(1);
  }
});

// Handle unhandled promise rejections
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
  
  if (isProduction) {
    log.info('Production mode: Enhanced security and logging enabled');
    log.info(`Health check available at: /health`);
    log.info(`API health check available at: /api/health`);
  }
});
