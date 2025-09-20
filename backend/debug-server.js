#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const app = express();
const port = 3001;

// Enable CORS
app.use(cors({
  origin: 'http://localhost:8080',
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'ProtoBuddy backend is running!', timestamp: new Date().toISOString() });
});

// API Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', message: 'ProtoBuddy API is running!' },
    timestamp: new Date().toISOString()
  });
});

// Simple chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    console.log('Received chat request:', req.body);

    const { message, sessionId } = req.body;

    const response = `Hello! You said: "${message}". I'm ProtoBuddy, your hardware component assistant. I can help you find Arduino components, check compatibility, and plan projects. What would you like to know?`;

    const chatMessage = {
      id: `msg-${Date.now()}`,
      content: response,
      sender: 'assistant',
      timestamp: new Date(),
    };

    const result = {
      success: true,
      data: {
        message: chatMessage,
        sessionId: sessionId || `session-${Date.now()}`,
        recommendations: [],
        compatibility: null
      },
      timestamp: new Date().toISOString()
    };

    console.log('Sending response:', JSON.stringify(result, null, 2));
    res.json(result);

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error: ' + error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!',
    details: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 ProtoBuddy Debug Backend running at http://localhost:${port}`);
  console.log(`🔧 Test the chat API: curl -X POST http://localhost:${port}/api/chat -H "Content-Type: application/json" -d '{"message":"Hello","sessionId":"test"}'`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully');
  process.exit(0);
});