import { Pool, PoolClient } from 'pg';
import Redis from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

// PostgreSQL connection pool
export const db = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // How long to wait for a connection
  ssl: config.env === 'production' ? { rejectUnauthorized: false } : false,
});

// Redis client
export const redis = Redis.createClient({
  url: config.redis.url,
  socket: {
    host: config.redis.host,
    port: config.redis.port,
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
  password: config.redis.password,
});

// Database connection handlers
db.on('connect', (client: PoolClient) => {
  logger.info('New database client connected');
});

db.on('error', (err: Error) => {
  logger.error('Database connection error:', err);
  process.exit(1);
});

// Redis connection handlers
redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('error', (err: Error) => {
  logger.error('Redis connection error:', err);
});

redis.on('reconnecting', () => {
  logger.info('Redis client reconnecting...');
});

// Initialize connections
export async function initializeConnections(): Promise<void> {
  try {
    // Test database connection
    const client = await db.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection established successfully');

    // Connect to Redis
    await redis.connect();
    logger.info('Redis connection established successfully');

    // Test Redis connection
    await redis.ping();
    logger.info('Redis ping successful');

  } catch (error) {
    logger.error('Failed to initialize connections:', error);
    throw error;
  }
}

// Graceful shutdown
export async function closeConnections(): Promise<void> {
  try {
    await db.end();
    logger.info('Database pool closed');

    await redis.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error closing connections:', error);
  }
}

// Database query helper with error handling
export async function query(text: string, params?: any[]): Promise<any> {
  const client = await db.connect();
  try {
    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Executed query', {
      text: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });

    return result;
  } catch (error) {
    logger.error('Database query error:', {
      query: text.substring(0, 100),
      params,
      error: error.message,
    });
    throw error;
  } finally {
    client.release();
  }
}

// Redis helpers with error handling
export const cache = {
  async get(key: string): Promise<string | null> {
    try {
      return await redis.get(key);
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await redis.setEx(key, ttlSeconds, value);
      } else {
        await redis.set(key, value);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  },

  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  },

  async keys(pattern: string): Promise<string[]> {
    try {
      return await redis.keys(pattern);
    } catch (error) {
      logger.error(`Cache keys error for pattern ${pattern}:`, error);
      return [];
    }
  },

  async flush(): Promise<void> {
    try {
      await redis.flushDb();
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  }
};

// Transaction helper
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Health check function
export async function healthCheck(): Promise<{ database: boolean; redis: boolean }> {
  const health = { database: false, redis: false };

  try {
    const client = await db.connect();
    await client.query('SELECT 1');
    client.release();
    health.database = true;
  } catch (error) {
    logger.error('Database health check failed:', error);
  }

  try {
    await redis.ping();
    health.redis = true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
  }

  return health;
}