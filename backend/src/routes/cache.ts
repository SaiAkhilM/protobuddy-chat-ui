import { Router, Request, Response } from 'express';
import { cache } from '../database/connection';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

const router = Router();

// GET /api/cache/stats - Get cache statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Get basic cache information
    const keys = await cache.keys('*');
    const totalKeys = keys.length;

    // Group keys by type
    const keysByType: { [key: string]: number } = {};
    for (const key of keys) {
      const type = key.split(':')[0];
      keysByType[type] = (keysByType[type] || 0) + 1;
    }

    // Get sample key sizes (first 10 keys)
    const sampleKeys = keys.slice(0, 10);
    const keySizes: { [key: string]: number } = {};

    for (const key of sampleKeys) {
      try {
        const value = await cache.get(key);
        if (value) {
          keySizes[key] = Buffer.byteLength(value, 'utf8');
        }
      } catch (error) {
        // Skip keys that can't be read
      }
    }

    const response: ApiResponse<{
      totalKeys: number;
      keysByType: { [key: string]: number };
      sampleKeySizes: { [key: string]: number };
      cacheInfo: any;
    }> = {
      success: true,
      data: {
        totalKeys,
        keysByType,
        sampleKeySizes: keySizes,
        cacheInfo: {
          // Add Redis-specific info here if needed
          connected: true,
        }
      },
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Get cache stats error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'CacheError',
      message: 'Failed to get cache statistics',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// GET /api/cache/keys - Get cache keys with optional pattern
router.get('/keys', async (req: Request, res: Response) => {
  try {
    const pattern = req.query.pattern as string || '*';
    const limit = parseInt(req.query.limit as string) || 100;

    let keys = await cache.keys(pattern);

    // Limit results
    if (keys.length > limit) {
      keys = keys.slice(0, limit);
    }

    const response: ApiResponse<{
      keys: string[];
      total: number;
      limited: boolean;
    }> = {
      success: true,
      data: {
        keys,
        total: keys.length,
        limited: keys.length === limit,
      },
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Get cache keys error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'CacheError',
      message: 'Failed to get cache keys',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// GET /api/cache/get/:key - Get specific cache key value
router.get('/get/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const value = await cache.get(key);

    if (value === null) {
      const response: ApiResponse = {
        success: false,
        error: 'NotFound',
        message: 'Cache key not found',
        timestamp: new Date(),
      };

      return res.status(404).json(response);
    }

    // Try to parse as JSON, fall back to string
    let parsedValue: any = value;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      // Keep as string
    }

    const response: ApiResponse<{
      key: string;
      value: any;
      size: number;
      type: string;
    }> = {
      success: true,
      data: {
        key,
        value: parsedValue,
        size: Buffer.byteLength(value, 'utf8'),
        type: typeof parsedValue,
      },
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Get cache key error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'CacheError',
      message: 'Failed to get cache key',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// DELETE /api/cache/delete/:key - Delete specific cache key
router.delete('/delete/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    // Check if key exists
    const exists = await cache.exists(key);

    if (!exists) {
      const response: ApiResponse = {
        success: false,
        error: 'NotFound',
        message: 'Cache key not found',
        timestamp: new Date(),
      };

      return res.status(404).json(response);
    }

    await cache.del(key);

    const response: ApiResponse = {
      success: true,
      message: 'Cache key deleted successfully',
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Delete cache key error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'CacheError',
      message: 'Failed to delete cache key',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// DELETE /api/cache/clear - Clear cache (pattern-based)
router.delete('/clear', async (req: Request, res: Response) => {
  try {
    const pattern = req.query.pattern as string || '';

    if (!pattern) {
      const response: ApiResponse = {
        success: false,
        error: 'BadRequest',
        message: 'Pattern parameter is required for safety',
        timestamp: new Date(),
      };

      return res.status(400).json(response);
    }

    // Get keys matching pattern
    const keys = await cache.keys(pattern);

    if (keys.length === 0) {
      const response: ApiResponse = {
        success: true,
        message: 'No keys found matching pattern',
        data: { deletedCount: 0 },
        timestamp: new Date(),
      };

      return res.json(response);
    }

    // Delete all matching keys
    const deletePromises = keys.map(key => cache.del(key));
    await Promise.all(deletePromises);

    logger.info(`Cleared ${keys.length} cache keys`, { pattern });

    const response: ApiResponse<{ deletedCount: number }> = {
      success: true,
      message: `Cleared ${keys.length} cache keys`,
      data: { deletedCount: keys.length },
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Clear cache error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'CacheError',
      message: 'Failed to clear cache',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// POST /api/cache/flush - Flush entire cache (dangerous!)
router.post('/flush', async (req: Request, res: Response) => {
  try {
    // This is a dangerous operation, require explicit confirmation
    const { confirm } = req.body;

    if (confirm !== 'FLUSH_ALL_CACHE') {
      const response: ApiResponse = {
        success: false,
        error: 'BadRequest',
        message: 'Confirmation required: set confirm to "FLUSH_ALL_CACHE"',
        timestamp: new Date(),
      };

      return res.status(400).json(response);
    }

    await cache.flush();

    logger.warn('Cache flushed - all data cleared');

    const response: ApiResponse = {
      success: true,
      message: 'Cache flushed successfully - all data cleared',
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Flush cache error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'CacheError',
      message: 'Failed to flush cache',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// GET /api/cache/health - Cache health check
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Test cache operations
    const testKey = `health-check-${Date.now()}`;
    const testValue = 'test';

    // Test set
    await cache.set(testKey, testValue, 60); // 60 second TTL

    // Test get
    const retrievedValue = await cache.get(testKey);

    // Test delete
    await cache.del(testKey);

    const isHealthy = retrievedValue === testValue;

    const response: ApiResponse<{
      healthy: boolean;
      operations: {
        set: boolean;
        get: boolean;
        delete: boolean;
      };
    }> = {
      success: true,
      data: {
        healthy: isHealthy,
        operations: {
          set: true,
          get: retrievedValue === testValue,
          delete: true,
        },
      },
      timestamp: new Date(),
    };

    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(response);

  } catch (error) {
    logger.error('Cache health check error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'CacheError',
      message: 'Cache health check failed',
      timestamp: new Date(),
    };

    res.status(503).json(response);
  }
});

export default router;