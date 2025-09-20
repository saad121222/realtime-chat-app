const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();

// Basic middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: ['https://papaya-pie-f13e16.netlify.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Simple health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Real-time Chat API - Vercel',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API is healthy' });
});

// Export for Vercel
module.exports = app;
