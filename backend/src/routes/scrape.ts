import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { validateRequest } from '../middleware';
import { ArduinoScraper } from '../scraping/actors/arduino-scraper';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

const router = Router();
const arduinoScraper = new ArduinoScraper();

// Validation schemas
const scrapeUrlSchema = Joi.object({
  url: Joi.string().uri().required(),
  type: Joi.string().valid('datasheet', 'tutorial', 'product', 'documentation').required(),
  priority: Joi.number().min(1).max(10).optional(),
});

const scrapeMultipleSchema = Joi.object({
  urls: Joi.array().items(Joi.object({
    url: Joi.string().uri().required(),
    type: Joi.string().valid('datasheet', 'tutorial', 'product', 'documentation').required(),
    priority: Joi.number().min(1).max(10).optional(),
  })).min(1).max(50).required(),
});

// POST /api/scrape/url - Scrape a specific URL
router.post('/url', validateRequest(scrapeUrlSchema), async (req: Request, res: Response) => {
  try {
    const { url, type, priority = 5 } = req.body;

    // Add to scraping queue
    await query(`
      INSERT INTO scraping_queue (url, type, priority, status)
      VALUES ($1, $2, $3, 'pending')
      ON CONFLICT (url) DO UPDATE SET
        priority = EXCLUDED.priority,
        status = 'pending',
        attempts = 0,
        error_message = NULL,
        scheduled_at = CURRENT_TIMESTAMP
    `, [url, type, priority]);

    const response: ApiResponse = {
      success: true,
      message: 'URL added to scraping queue',
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Add URL to scraping queue error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'ScrapeError',
      message: 'Failed to add URL to scraping queue',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// POST /api/scrape/multiple - Scrape multiple URLs
router.post('/multiple', validateRequest(scrapeMultipleSchema), async (req: Request, res: Response) => {
  try {
    const { urls } = req.body;

    for (const urlData of urls) {
      await query(`
        INSERT INTO scraping_queue (url, type, priority, status)
        VALUES ($1, $2, $3, 'pending')
        ON CONFLICT (url) DO UPDATE SET
          priority = EXCLUDED.priority,
          status = 'pending',
          attempts = 0,
          error_message = NULL,
          scheduled_at = CURRENT_TIMESTAMP
      `, [urlData.url, urlData.type, urlData.priority || 5]);
    }

    const response: ApiResponse = {
      success: true,
      message: `${urls.length} URLs added to scraping queue`,
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Add multiple URLs to scraping queue error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'ScrapeError',
      message: 'Failed to add URLs to scraping queue',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// POST /api/scrape/arduino - Trigger Arduino documentation scraping
router.post('/arduino', async (req: Request, res: Response) => {
  try {
    // Start Arduino scraping in background
    const scrapePromise = arduinoScraper.scrapeArduinoDocumentation()
      .then(results => {
        logger.info('Arduino documentation scraping completed', {
          resultsCount: results.length
        });
        return results;
      })
      .catch(error => {
        logger.error('Arduino documentation scraping failed:', error);
        throw error;
      });

    const response: ApiResponse = {
      success: true,
      message: 'Arduino documentation scraping started',
      timestamp: new Date(),
    };

    res.json(response);

    // Don't await - let it run in background
    scrapePromise;

  } catch (error) {
    logger.error('Start Arduino scraping error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'ScrapeError',
      message: 'Failed to start Arduino scraping',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// POST /api/scrape/arduino/hardware - Trigger Arduino hardware scraping
router.post('/arduino/hardware', async (req: Request, res: Response) => {
  try {
    // Start Arduino hardware scraping in background
    const scrapePromise = arduinoScraper.scrapeArduinoHardware()
      .then(results => {
        logger.info('Arduino hardware scraping completed', {
          resultsCount: results.length
        });
        return results;
      })
      .catch(error => {
        logger.error('Arduino hardware scraping failed:', error);
        throw error;
      });

    const response: ApiResponse = {
      success: true,
      message: 'Arduino hardware scraping started',
      timestamp: new Date(),
    };

    res.json(response);

    // Don't await - let it run in background
    scrapePromise;

  } catch (error) {
    logger.error('Start Arduino hardware scraping error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'ScrapeError',
      message: 'Failed to start Arduino hardware scraping',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// POST /api/scrape/arduino/tutorials - Trigger Arduino tutorials scraping
router.post('/arduino/tutorials', async (req: Request, res: Response) => {
  try {
    // Start Arduino tutorials scraping in background
    const scrapePromise = arduinoScraper.scrapeArduinoTutorials()
      .then(results => {
        logger.info('Arduino tutorials scraping completed', {
          resultsCount: results.length
        });
        return results;
      })
      .catch(error => {
        logger.error('Arduino tutorials scraping failed:', error);
        throw error;
      });

    const response: ApiResponse = {
      success: true,
      message: 'Arduino tutorials scraping started',
      timestamp: new Date(),
    };

    res.json(response);

    // Don't await - let it run in background
    scrapePromise;

  } catch (error) {
    logger.error('Start Arduino tutorials scraping error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'ScrapeError',
      message: 'Failed to start Arduino tutorials scraping',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// GET /api/scrape/queue - Get scraping queue status
router.get('/queue', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    let whereClause = '';
    const params: any[] = [limit, offset];

    if (status) {
      whereClause = 'WHERE status = $3';
      params.push(status);
    }

    const result = await query(`
      SELECT * FROM scraping_queue
      ${whereClause}
      ORDER BY priority DESC, scheduled_at ASC
      LIMIT $1 OFFSET $2
    `, params);

    const countResult = await query(`
      SELECT COUNT(*) as total FROM scraping_queue ${whereClause}
    `, status ? [status] : []);

    const response: ApiResponse<{
      queue: any[];
      total: number;
      pagination: { limit: number; offset: number };
    }> = {
      success: true,
      data: {
        queue: result.rows,
        total: parseInt(countResult.rows[0].total, 10),
        pagination: { limit, offset },
      },
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Get scraping queue error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'QueueError',
      message: 'Failed to get scraping queue',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// GET /api/scrape/stats - Get scraping statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [queueStats, dataStats] = await Promise.all([
      // Queue statistics
      query(`
        SELECT
          status,
          COUNT(*) as count
        FROM scraping_queue
        GROUP BY status
      `),

      // Scraped data statistics
      query(`
        SELECT
          metadata->>'source' as source,
          metadata->>'type' as type,
          processed,
          COUNT(*) as count
        FROM scraped_data
        GROUP BY metadata->>'source', metadata->>'type', processed
      `)
    ]);

    const queueStatsByStatus = queueStats.rows.reduce((acc: any, row: any) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    }, {});

    const dataStatsBySource = dataStats.rows.reduce((acc: any, row: any) => {
      const key = `${row.source || 'unknown'}_${row.type || 'unknown'}`;
      if (!acc[key]) {
        acc[key] = { processed: 0, unprocessed: 0 };
      }
      if (row.processed) {
        acc[key].processed = parseInt(row.count, 10);
      } else {
        acc[key].unprocessed = parseInt(row.count, 10);
      }
      return acc;
    }, {});

    const response: ApiResponse<{
      queue: any;
      data: any;
    }> = {
      success: true,
      data: {
        queue: queueStatsByStatus,
        data: dataStatsBySource,
      },
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Get scraping stats error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'StatsError',
      message: 'Failed to get scraping statistics',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// DELETE /api/scrape/queue/:id - Remove item from scraping queue
router.delete('/queue/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM scraping_queue WHERE id = $1', [id]);

    if (result.rowCount && result.rowCount > 0) {
      const response: ApiResponse = {
        success: true,
        message: 'Item removed from scraping queue',
        timestamp: new Date(),
      };

      res.json(response);
    } else {
      const response: ApiResponse = {
        success: false,
        error: 'NotFound',
        message: 'Queue item not found',
        timestamp: new Date(),
      };

      res.status(404).json(response);
    }

  } catch (error) {
    logger.error('Remove queue item error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'QueueError',
      message: 'Failed to remove item from queue',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// POST /api/scrape/queue/retry/:id - Retry failed scraping item
router.post('/queue/retry/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(`
      UPDATE scraping_queue
      SET status = 'pending', attempts = 0, error_message = NULL, scheduled_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'failed'
    `, [id]);

    if (result.rowCount && result.rowCount > 0) {
      const response: ApiResponse = {
        success: true,
        message: 'Item scheduled for retry',
        timestamp: new Date(),
      };

      res.json(response);
    } else {
      const response: ApiResponse = {
        success: false,
        error: 'NotFound',
        message: 'Failed queue item not found',
        timestamp: new Date(),
      };

      res.status(404).json(response);
    }

  } catch (error) {
    logger.error('Retry queue item error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'QueueError',
      message: 'Failed to retry queue item',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

export default router;