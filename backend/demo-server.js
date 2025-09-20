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

// Mock data for components
const mockComponents = [
  {
    id: 1,
    name: "DHT22 Temperature & Humidity Sensor",
    manufacturer: "Aosong",
    category: "sensor",
    description: "Digital temperature and humidity sensor with high accuracy",
    price: 8.50,
    specifications: {
      voltage: { min: 3.3, max: 5.5, unit: "V" },
      current: { typical: 1.5, max: 2.5, unit: "mA" },
      communication: [{ type: "digital", protocol: "1-wire" }],
      temperature_range: { min: -40, max: 80, unit: "°C" },
      humidity_range: { min: 0, max: 100, unit: "%RH" }
    }
  },
  {
    id: 2,
    name: "Arduino Uno R3",
    manufacturer: "Arduino",
    category: "microcontroller",
    description: "Popular microcontroller board based on ATmega328P",
    price: 27.60,
    specifications: {
      voltage: { operating: 5, input: { min: 7, max: 12 }, unit: "V" },
      current: 50,
      pins: { digital: 14, analog: 6, pwm: 6 },
      memory: { flash: 32, sram: 2, eeprom: 1, unit: "KB" }
    }
  },
  {
    id: 3,
    name: "HC-SR04 Ultrasonic Sensor",
    manufacturer: "Generic",
    category: "sensor",
    description: "Ultrasonic distance measuring sensor module",
    price: 3.20,
    specifications: {
      voltage: { min: 5, max: 5, unit: "V" },
      current: { typical: 15, unit: "mA" },
      range: { min: 2, max: 400, unit: "cm" },
      accuracy: 3,
      communication: [{ type: "digital", protocol: "trigger-echo" }]
    }
  }
];

const mockBoards = [
  {
    id: 1,
    name: "Arduino Uno R3",
    manufacturer: "Arduino",
    type: "microcontroller",
    specifications: {
      voltage: { operating: 5, input: { min: 7, max: 12 }, unit: "V" },
      pins: { digital: 14, analog: 6, pwm: 6 },
      memory: { flash: 32, sram: 2, eeprom: 1, unit: "KB" }
    }
  }
];

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'ProtoBuddy backend is running!', timestamp: new Date().toISOString() });
});

// API Health check (to match frontend expectations)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', message: 'ProtoBuddy API is running!' },
    timestamp: new Date().toISOString()
  });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    // Simple intent detection
    const lowerMessage = message.toLowerCase();
    let response = "";
    let type = "general";

    console.log('Processing message:', message, 'lowercased:', lowerMessage);

    if (lowerMessage.includes('sensor') || lowerMessage.includes('temperature') || lowerMessage.includes('humidity') || lowerMessage.includes('onset')) {
      type = "component_search";
      response = `I found some great sensors for your project! For a portable onset sensor, you'll likely want:

🌡️ **DHT22** - Temperature and humidity sensing ($8.50)
- Accurate ±0.5°C temperature, ±2-5% humidity
- 3.3V-5V compatible, perfect for portable projects
- Single wire digital communication

📏 **HC-SR04** - Ultrasonic distance sensor ($3.20)
- 2cm to 400cm range detection
- Great for proximity/motion detection
- Low power consumption

For portability, consider adding a battery pack and maybe an LCD display. Would you like specific component recommendations or wiring diagrams?`;
    } else if (lowerMessage.includes('arduino') || lowerMessage.includes('board') || lowerMessage.includes('microcontroller') || lowerMessage.includes('components')) {
      type = "component_search";
      response = `Perfect! Here are some essential Arduino components for your project:

🎛️ **Arduino Uno R3** ($27.60) - The classic choice
- 14 digital pins, 6 analog inputs, 6 PWM outputs
- 5V operation, USB or 7-12V external power
- Perfect for sensor integration

🔋 **For Portable Power:**
- 9V battery holder with DC jack
- Li-ion battery shield with USB charging
- Solar panel for outdoor projects

📱 **Display Options:**
- 16x2 LCD display ($3-5)
- OLED displays for low power
- LED indicators for simple status

What type of onset detection are you planning? Environmental, motion, or something else?`;
    } else if (lowerMessage.includes('compatible') || lowerMessage.includes('compatibility') || lowerMessage.includes('work with') || lowerMessage.includes('connect')) {
      type = "compatibility_check";
      response = `Excellent question about compatibility! Let me check the key factors:

✅ **Voltage Compatibility:**
- Arduino Uno: 5V logic, 3.3V tolerant
- DHT22: 3.3V-5.5V (perfect match!)
- HC-SR04: 5V (perfect match!)

✅ **Current Requirements:**
- Arduino can provide 50mA per pin
- DHT22 uses ~1.5mA (very low power)
- HC-SR04 uses ~15mA (well within limits)

✅ **Pin Requirements:**
- DHT22: 1 digital pin + power/ground
- HC-SR04: 2 digital pins (trigger/echo) + power/ground

All components work great together! Need help with specific wiring or pin assignments?`;
    } else if (lowerMessage.includes('project') || lowerMessage.includes('build') || lowerMessage.includes('make') || lowerMessage.includes('portable')) {
      type = "project_help";
      response = `Great project idea! A portable onset sensor can be really useful. Here's a suggested build approach:

🎯 **Phase 1 - Basic Detection:**
1. Arduino Uno + breadboard setup
2. Add your primary sensor (temperature/humidity/motion)
3. Simple LED indicator for detection events
4. Serial monitor for debugging

🎯 **Phase 2 - Portability:**
1. Add battery pack (9V or Li-ion)
2. LCD display for standalone operation
3. Data logging to SD card
4. Compact enclosure

🎯 **Phase 3 - Advanced Features:**
1. Wireless connectivity (WiFi/Bluetooth)
2. Mobile app integration
3. Multiple sensor fusion
4. Solar charging option

What type of "onset" are you looking to detect? This will help me suggest the best sensors!`;
    } else if (lowerMessage.includes('help') || lowerMessage.includes('how') || lowerMessage.includes('tutorial') || lowerMessage.includes('find')) {
      response = `I'm here to help with your hardware project! I can assist you with:

🔍 **Component Search** - Find sensors, boards, modules, and parts
⚡ **Compatibility Checks** - Ensure components work together safely
🛠️ **Project Planning** - Break down builds into manageable steps
🔧 **Wiring Help** - Pin assignments and connection diagrams
📚 **Code Examples** - Arduino sketches and libraries
💡 **Troubleshooting** - Debug hardware and software issues

For your portable onset sensor project, I can help you:
- Choose the right sensors for your detection needs
- Plan the power system for portability
- Design the data collection and storage
- Create a housing and mounting strategy

What specific aspect would you like to dive into first?`;
    } else {
      response = `Hello! I understand you said: "${message}". I'm ProtoBuddy, your AI hardware engineering assistant specializing in Arduino and compatible components.

I can help you with:
- **Component recommendations** - Find the right parts for your project
- **Compatibility analysis** - Ensure components work together
- **Project planning** - Break down complex builds
- **Wiring guidance** - Pin assignments and connections
- **Troubleshooting** - Debug hardware issues

Try asking me something like:
- "I need sensors for a weather station"
- "Help me build a motion detector"
- "Are these components compatible with Arduino?"
- "How do I connect a DHT22 sensor?"

What hardware project can I help you with today?`;
    }

    const chatMessage = {
      id: `msg-${Date.now()}`,
      content: response,
      sender: 'assistant',
      timestamp: new Date(),
    };

    // Return in the expected API format
    res.json({
      success: true,
      data: {
        message: chatMessage,
        sessionId: sessionId || `session-${Date.now()}`,
        recommendations: type === 'component_search' ? mockComponents.slice(0, 3) : [],
        compatibility: type === 'compatibility_check' ? { compatible: true, score: 95 } : null
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Components search
app.get('/api/components/search', (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, limit = 10 } = req.query;

    let results = [...mockComponents];

    if (q) {
      const query = q.toLowerCase();
      results = results.filter(comp =>
        comp.name.toLowerCase().includes(query) ||
        comp.description.toLowerCase().includes(query) ||
        comp.category.toLowerCase().includes(query)
      );
    }

    if (category) {
      results = results.filter(comp => comp.category === category);
    }

    if (minPrice) {
      results = results.filter(comp => comp.price >= parseFloat(minPrice));
    }

    if (maxPrice) {
      results = results.filter(comp => comp.price <= parseFloat(maxPrice));
    }

    results = results.slice(0, parseInt(limit));

    res.json({
      components: results,
      total: results.length,
      query: { q, category, minPrice, maxPrice, limit }
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get component by ID
app.get('/api/components/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const component = mockComponents.find(c => c.id === id);

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.json(component);

  } catch (error) {
    console.error('Component fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Compatibility check
app.post('/api/compatibility/check', (req, res) => {
  try {
    const { boardId, componentIds } = req.body;

    // Simple mock compatibility logic
    const compatible = true;
    const score = 95;
    const issues = [];
    const suggestions = [
      "Connect VCC to 5V pin on Arduino",
      "Use pull-up resistors for reliable communication",
      "Add decoupling capacitors for stable operation"
    ];

    res.json({
      compatible,
      score,
      issues,
      suggestions,
      details: {
        voltage: "Compatible - both operate at 5V",
        current: "Within limits - total draw ~20mA",
        pins: "Sufficient pins available",
        communication: "Standard digital I/O protocols"
      }
    });

  } catch (error) {
    console.error('Compatibility check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Boards endpoint
app.get('/api/boards', (req, res) => {
  res.json({ boards: mockBoards });
});

// Cache endpoints (mock)
app.get('/api/cache/stats', (req, res) => {
  res.json({
    redis: { connected: false, keys: 0 },
    database: { connected: false, components: 3, boards: 1 },
    scraping: { lastRun: null, totalScraped: 0 }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 ProtoBuddy Demo Backend running at http://localhost:${port}`);
  console.log(`🔧 API endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   POST /api/chat - Chat with ProtoBuddy`);
  console.log(`   GET  /api/components/search - Search components`);
  console.log(`   GET  /api/components/:id - Get component details`);
  console.log(`   POST /api/compatibility/check - Check compatibility`);
  console.log(`   GET  /api/boards - List available boards`);
  console.log(`   GET  /api/cache/stats - Cache statistics`);
  console.log(`\n💡 Try the frontend at http://localhost:8080`);
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