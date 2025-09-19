import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

interface Config {
  env: string;
  port: number;
  corsOrigin: string;
  database: {
    url: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  redis: {
    url: string;
    host: string;
    port: number;
    password?: string;
  };
  apis: {
    anthropic: {
      apiKey: string;
    };
    apify: {
      token: string;
    };
  };
  scraping: {
    delayMs: number;
    maxConcurrent: number;
    timeoutMs: number;
  };
  cache: {
    ttlSeconds: number;
    maxSize: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  logging: {
    level: string;
    file: string;
  };
  ocr: {
    language: string;
    dpi: number;
    psm: number;
  };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:8080',

  database: {
    url: process.env.DATABASE_URL || '',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    name: process.env.DATABASE_NAME || 'protobuddy',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  apis: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    },
    apify: {
      token: process.env.APIFY_API_TOKEN || '',
    },
  },

  scraping: {
    delayMs: parseInt(process.env.SCRAPE_DELAY_MS || '1000', 10),
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_SCRAPES || '3', 10),
    timeoutMs: parseInt(process.env.SCRAPE_TIMEOUT_MS || '30000', 10),
  },

  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10),
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '10000', 10),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/protobuddy.log',
  },

  ocr: {
    language: process.env.TESSERACT_LANG || 'eng',
    dpi: parseInt(process.env.OCR_DPI || '300', 10),
    psm: parseInt(process.env.OCR_PSM || '6', 10),
  },
};

// Validation
function validateConfig(): void {
  const requiredEnvVars = [
    'ANTHROPIC_API_KEY',
    'APIFY_API_TOKEN',
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName] || process.env[varName] === ''
  );

  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars);
    console.error('Please check your .env file or environment configuration');

    if (config.env === 'production') {
      process.exit(1);
    } else {
      console.warn('Continuing in development mode without API keys...');
    }
  }

  // Database URL validation
  if (!config.database.url && (!config.database.host || !config.database.name)) {
    console.error('Database configuration incomplete. Please set DATABASE_URL or provide HOST/NAME/USER/PASSWORD');
    if (config.env === 'production') {
      process.exit(1);
    }
  }

  // Redis URL validation
  if (!config.redis.url && !config.redis.host) {
    console.error('Redis configuration incomplete. Please set REDIS_URL or provide HOST/PORT');
    if (config.env === 'production') {
      process.exit(1);
    }
  }
}

// Run validation
validateConfig();

export { config };

// Helper functions
export function isDevelopment(): boolean {
  return config.env === 'development';
}

export function isProduction(): boolean {
  return config.env === 'production';
}

export function isTest(): boolean {
  return config.env === 'test';
}

// Cache key generators
export const cacheKeys = {
  component: (id: string) => `component:${id}`,
  compatibility: (boardId: string, componentId: string) => `compat:${boardId}:${componentId}`,
  project: (type: string) => `project:${type}`,
  scrape: (url: string) => `scrape:${Buffer.from(url).toString('base64')}`,
  search: (query: string) => `search:${Buffer.from(query).toString('base64')}`,
  session: (sessionId: string) => `session:${sessionId}`,
};

// Common regular expressions
export const patterns = {
  voltage: /(\d+(?:\.\d+)?)\s*(?:V|v|volt|volts)/gi,
  current: /(\d+(?:\.\d+)?)\s*(?:mA|ma|A|amp|amps)/gi,
  frequency: /(\d+(?:\.\d+)?)\s*(?:Hz|hz|MHz|mhz|GHz|ghz|kHz|khz)/gi,
  temperature: /(-?\d+(?:\.\d+)?)\s*(?:°C|°F|C|F|celsius|fahrenheit)/gi,
  dimensions: /(\d+(?:\.\d+)?)\s*(?:mm|cm|in|inch|inches)\s*x\s*(\d+(?:\.\d+)?)\s*(?:mm|cm|in|inch|inches)(?:\s*x\s*(\d+(?:\.\d+)?)\s*(?:mm|cm|in|inch|inches))?/gi,
};

export default config;