#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3001;

// Initialize Claude API
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Enable CORS
app.use(cors({
  origin: 'http://localhost:8080',
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Component database (will be populated by scraping)
let componentDatabase = {
  sensors: [],
  microcontrollers: [],
  modules: [],
  lastUpdated: null
};

// Real component scraping functions
async function scrapeSparkfunComponents(query, category = 'sensors') {
  try {
    console.log(`Scraping Sparkfun for: ${query} in category: ${category}`);

    // SparkFun search URL
    const searchUrl = `https://www.sparkfun.com/search/results?term=${encodeURIComponent(query)}&category=${category}`;

    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const components = [];

    // Parse SparkFun product listings
    $('.product-card, .search-result').each((i, element) => {
      if (i >= 5) return false; // Limit to 5 results

      const $el = $(element);
      const name = $el.find('.product-title, .product-name, h3, h4').first().text().trim();
      const price = $el.find('.price, .product-price').first().text().trim();
      const link = $el.find('a').first().attr('href');
      const description = $el.find('.description, .product-description, p').first().text().trim();

      if (name) {
        components.push({
          id: `sf-${Date.now()}-${i}`,
          name: name,
          manufacturer: 'SparkFun',
          category: category,
          description: description || `${name} from SparkFun`,
          price: parseFloat(price?.replace(/[^0-9.]/g, '')) || null,
          url: link?.startsWith('http') ? link : `https://www.sparkfun.com${link}`,
          source: 'sparkfun',
          specifications: {
            voltage: { min: 3.3, max: 5, unit: "V" },
            current: { typical: 10, unit: "mA" }
          }
        });
      }
    });

    return components;
  } catch (error) {
    console.error('Sparkfun scraping error:', error.message);
    return [];
  }
}

async function scrapeAdafruitComponents(query, category = 'sensors') {
  try {
    console.log(`Scraping Adafruit for: ${query} in category: ${category}`);

    // Adafruit search URL
    const searchUrl = `https://www.adafruit.com/search?q=${encodeURIComponent(query)}&b=1`;

    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const components = [];

    // Parse Adafruit product listings
    $('.product-listing-item, .product-item').each((i, element) => {
      if (i >= 5) return false; // Limit to 5 results

      const $el = $(element);
      const name = $el.find('.product-name, h3, h4').first().text().trim();
      const price = $el.find('.price').first().text().trim();
      const link = $el.find('a').first().attr('href');
      const description = $el.find('.description, p').first().text().trim();

      if (name) {
        components.push({
          id: `ada-${Date.now()}-${i}`,
          name: name,
          manufacturer: 'Adafruit',
          category: category,
          description: description || `${name} from Adafruit`,
          price: parseFloat(price?.replace(/[^0-9.]/g, '')) || null,
          url: link?.startsWith('http') ? link : `https://www.adafruit.com${link}`,
          source: 'adafruit',
          specifications: {
            voltage: { min: 3.3, max: 5, unit: "V" },
            current: { typical: 15, unit: "mA" }
          }
        });
      }
    });

    return components;
  } catch (error) {
    console.error('Adafruit scraping error:', error.message);
    return [];
  }
}

// Intelligent component search using Claude + real scraping
async function intelligentComponentSearch(userMessage) {
  try {
    console.log('Getting intelligent recommendations from Claude...');

    // First, ask Claude to analyze the user's request
    const analysisResponse = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are ProtoBuddy, an expert hardware component assistant. Analyze this user request and extract:

1. Component type needed (sensor, microcontroller, module, etc.)
2. Specific sensor type if mentioned (temperature, humidity, gas, motion, etc.)
3. Key requirements (voltage, size, accuracy, etc.)
4. Search terms for component databases

User request: "${userMessage}"

Respond in JSON format:
{
  "componentType": "sensor|microcontroller|module|other",
  "specificType": "gas|temperature|motion|etc",
  "searchTerms": ["term1", "term2"],
  "requirements": {
    "voltage": "3.3V or 5V",
    "power": "low power preferred",
    "other": "portable, accurate, etc"
  }
}`
      }]
    });

    let analysis;
    try {
      analysis = JSON.parse(analysisResponse.content[0].text);
    } catch (e) {
      console.log('Could not parse Claude response as JSON, using fallback');
      analysis = {
        componentType: "sensor",
        specificType: "gas",
        searchTerms: ["carbon monoxide sensor", "gas sensor"],
        requirements: { voltage: "3.3V or 5V", power: "low power preferred" }
      };
    }

    console.log('Claude analysis:', analysis);

    // Now scrape real components based on Claude's analysis
    let allComponents = [];

    for (const searchTerm of analysis.searchTerms) {
      console.log(`Searching for: ${searchTerm}`);

      // Search multiple sources
      const [sparkfunResults, adafruitResults] = await Promise.all([
        scrapeSparkfunComponents(searchTerm, analysis.componentType),
        scrapeAdafruitComponents(searchTerm, analysis.componentType)
      ]);

      allComponents = allComponents.concat(sparkfunResults, adafruitResults);
    }

    // Remove duplicates and limit results
    const uniqueComponents = allComponents.filter((comp, index, self) =>
      index === self.findIndex(c => c.name.toLowerCase() === comp.name.toLowerCase())
    ).slice(0, 6);

    console.log(`Found ${uniqueComponents.length} unique components`);

    // Now ask Claude to generate a helpful response with the real components
    const responsePrompt = `You are ProtoBuddy, a friendly hardware expert. The user asked: "${userMessage}"

Based on my analysis, I found these real components:

${uniqueComponents.map(c => `- ${c.name} by ${c.manufacturer} - ${c.description} ${c.price ? `($${c.price})` : ''}`).join('\n')}

Requirements identified:
${Object.entries(analysis.requirements).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

Generate a helpful, technical but friendly response that:
1. Acknowledges their specific request (carbon monoxide sensor, etc.)
2. Recommends the most suitable components from the list above
3. Explains why these components are good choices
4. Mentions key specifications and compatibility
5. Offers to help with next steps (wiring, code, etc.)

Keep it concise but informative, like a knowledgeable engineer helping a colleague.`;

    const finalResponse = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: responsePrompt
      }]
    });

    return {
      response: finalResponse.content[0].text,
      components: uniqueComponents,
      analysis: analysis
    };

  } catch (error) {
    console.error('Intelligent search error:', error);

    // Fallback response
    return {
      response: `I encountered an issue while searching for components. However, for a carbon monoxide sensor project, I'd recommend looking for MQ-7 or MQ-135 gas sensors, which are commonly available and work well with Arduino. Would you like me to help you find specific models or discuss the project requirements?`,
      components: [],
      analysis: null
    };
  }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'ProtoBuddy Intelligent Backend is running!', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', message: 'ProtoBuddy Intelligent API is running!' },
    timestamp: new Date().toISOString()
  });
});

// Intelligent Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    console.log(`\n=== Processing message: "${message}" ===`);

    // Get intelligent response using Claude + real component scraping
    const result = await intelligentComponentSearch(message);

    const chatMessage = {
      id: `msg-${Date.now()}`,
      content: result.response,
      sender: 'assistant',
      timestamp: new Date(),
    };

    // Return in the expected API format
    res.json({
      success: true,
      data: {
        message: chatMessage,
        sessionId: sessionId || `session-${Date.now()}`,
        recommendations: result.components || [],
        compatibility: result.analysis || null
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'I apologize, but I encountered an error. Please try again.',
      timestamp: new Date().toISOString()
    });
  }
});

// Keep existing endpoints for compatibility
app.get('/api/components/search', (req, res) => {
  res.json({
    success: true,
    data: componentDatabase.sensors.concat(componentDatabase.microcontrollers).slice(0, 10),
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, () => {
  console.log(`🧠 ProtoBuddy Intelligent Backend running at http://localhost:${port}`);
  console.log(`🔧 Features:`);
  console.log(`   🤖 Claude-3 Haiku for intelligent responses`);
  console.log(`   🕷️  Real-time component scraping from SparkFun & Adafruit`);
  console.log(`   🎯 Context-aware component recommendations`);
  console.log(`   ⚡ Smart intent recognition and technical guidance`);
  console.log(`\n💡 Frontend: http://localhost:8080`);
  console.log(`📊 API Key: ${process.env.ANTHROPIC_API_KEY ? '✅ Loaded' : '❌ Missing'}`);
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