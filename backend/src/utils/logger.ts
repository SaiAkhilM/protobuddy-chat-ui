import winston from 'winston';
import path from 'path';
import { config } from '../config';

// Create logs directory if it doesn't exist
const logDir = path.dirname(config.logging.file);

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
      let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
      }

      if (stack) {
        log += `\n${stack}`;
      }

      return log;
    })
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
          let log = `${timestamp} ${level}: ${message}`;

          if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta, null, 2)}`;
          }

          if (stack) {
            log += `\n${stack}`;
          }

          return log;
        })
      ),
    }),

    // File transport
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),

    // Error file transport
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
});

// Add request logging helper
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, url, ip } = req;
    const { statusCode } = res;

    logger.info('HTTP Request', {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      ip,
      userAgent: req.get('User-Agent'),
    });
  });

  next();
};

// Error logging helper
export const logError = (error: Error, context?: any) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    context,
  });
};

// Performance logging helper
export const logPerformance = (operation: string, startTime: number, metadata?: any) => {
  const duration = Date.now() - startTime;
  logger.info('Performance Metric', {
    operation,
    duration: `${duration}ms`,
    ...metadata,
  });
};

// Database query logging helper
export const logQuery = (query: string, params?: any[], duration?: number, rowCount?: number) => {
  logger.debug('Database Query', {
    query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
    params: params ? JSON.stringify(params) : undefined,
    duration: duration ? `${duration}ms` : undefined,
    rowCount,
  });
};

// Scraping logging helpers
export const logScrapeStart = (url: string, type: string) => {
  logger.info('Scrape Started', { url, type });
};

export const logScrapeSuccess = (url: string, type: string, duration: number, dataCount: number) => {
  logger.info('Scrape Completed', {
    url,
    type,
    duration: `${duration}ms`,
    dataCount
  });
};

export const logScrapeError = (url: string, type: string, error: Error) => {
  logger.error('Scrape Failed', {
    url,
    type,
    error: error.message,
    stack: error.stack
  });
};

// Cache logging helpers
export const logCacheHit = (key: string, operation: string = 'get') => {
  logger.debug('Cache Hit', { key, operation });
};

export const logCacheMiss = (key: string, operation: string = 'get') => {
  logger.debug('Cache Miss', { key, operation });
};

export const logCacheError = (key: string, operation: string, error: Error) => {
  logger.error('Cache Error', {
    key,
    operation,
    error: error.message
  });
};

// API logging helpers
export const logApiCall = (service: string, endpoint: string, duration: number, success: boolean) => {
  logger.info('External API Call', {
    service,
    endpoint,
    duration: `${duration}ms`,
    success,
  });
};

export const logApiError = (service: string, endpoint: string, error: Error) => {
  logger.error('External API Error', {
    service,
    endpoint,
    error: error.message,
    stack: error.stack,
  });
};

// Compatibility check logging
export const logCompatibilityCheck = (boardId: string, componentId: string, result: boolean, issues: number) => {
  logger.info('Compatibility Check', {
    boardId,
    componentId,
    compatible: result,
    issuesCount: issues,
  });
};

// User interaction logging
export const logUserInteraction = (sessionId: string, action: string, metadata?: any) => {
  logger.info('User Interaction', {
    sessionId,
    action,
    ...metadata,
  });
};

export { logger };