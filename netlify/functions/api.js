const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { supabase, testConnection } = require('../../backend/config/supabase');
const authRoutes = require('../../backend/routes/auth');
const userRoutes = require('../../backend/routes/users');
const chatRoutes = require('../../backend/routes/chats');
const messageRoutes = require('../../backend/routes/messages');

const app = express();

// Initialize database connection
testConnection().catch(console.error);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: ['https://papaya-pie-f13e16.netlify.app', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Real-time Chat API - Netlify Functions',
    timestamp: new Date().toISOString(),
    database: 'Supabase PostgreSQL'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/chats', chatRoutes);
app.use('/messages', messageRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong!',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

module.exports.handler = serverless(app);
