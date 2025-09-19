import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '../database/connection';
import { config } from '../config';
import { logger, requestLogger, logError } from '../utils/logger';
import { ApiResponse } from '../types';

// CORS configuration
export const corsMiddleware = cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
});

// Security middleware
export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// Compression middleware
export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
});

// Rate limiting
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:',
  points: config.rateLimit.maxRequests,
  duration: Math.floor(config.rateLimit.windowMs / 1000),
  blockDuration: Math.floor(config.rateLimit.windowMs / 1000),
});

export const rateLimitMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const key = req.ip || 'unknown';
    const result = await rateLimiter.consume(key);

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': config.rateLimit.maxRequests.toString(),
      'X-RateLimit-Remaining': result.remainingPoints?.toString() || '0',
      'X-RateLimit-Reset': new Date(Date.now() + result.msBeforeNext || 0).toISOString(),
    });

    next();
  } catch (rejRes: any) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;

    res.set({
      'Retry-After': secs.toString(),
      'X-RateLimit-Limit': config.rateLimit.maxRequests.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': new Date(Date.now() + rejRes.msBeforeNext || 0).toISOString(),
    });

    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });

    const response: ApiResponse = {
      success: false,
      error: 'Rate limit exceeded',
      message: `Too many requests, try again in ${secs} seconds`,
      timestamp: new Date(),
    };

    res.status(429).json(response);
  }
};

// Request validation middleware
export const validateRequest = (schema: any) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { error } = schema.validate(req.body);

    if (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Validation error',
        message: error.details.map((detail: any) => detail.message).join(', '),
        timestamp: new Date(),
      };

      logger.warn('Request validation failed', {
        path: req.path,
        method: req.method,
        errors: error.details,
      });

      return res.status(400).json(response);
    }

    next();
  };
};

// Error handling middleware
export const errorHandler = (
  error: any,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  logError(error, {
    method: req.method,
    url: req.url,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Don't expose internal errors in production
  const isDev = config.env === 'development';
  let message = 'Internal server error';
  let statusCode = 500;

  // Handle known error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = isDev ? error.message : 'Invalid request data';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Resource not found';
  } else if (error.code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    message = 'Resource already exists';
  } else if (error.code === '23503') { // PostgreSQL foreign key violation
    statusCode = 400;
    message = 'Invalid reference';
  }

  const response: ApiResponse = {
    success: false,
    error: error.name || 'InternalServerError',
    message,
    timestamp: new Date(),
    ...(isDev && { stack: error.stack }),
  };

  res.status(statusCode).json(response);
};

// 404 handler
export const notFoundHandler = (
  req: express.Request,
  res: express.Response
) => {
  const response: ApiResponse = {
    success: false,
    error: 'NotFound',
    message: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date(),
  };

  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    ip: req.ip,
  });

  res.status(404).json(response);
};

// Health check middleware
export const healthCheck = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { healthCheck } = await import('../database/connection');
    const health = await healthCheck();

    const response: ApiResponse = {
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: health,
      },
      timestamp: new Date(),
    };

    const statusCode = health.database && health.redis ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: 'HealthCheckFailed',
      message: 'Health check failed',
      timestamp: new Date(),
    };

    res.status(503).json(response);
  }
};

// Request timeout middleware
export const timeoutMiddleware = (timeoutMs: number = 30000) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const response: ApiResponse = {
          success: false,
          error: 'RequestTimeout',
          message: 'Request timeout',
          timestamp: new Date(),
        };

        logger.warn('Request timeout', {
          method: req.method,
          url: req.url,
          timeout: `${timeoutMs}ms`,
        });

        res.status(408).json(response);
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

// Content type middleware
export const jsonMiddleware = express.json({
  limit: '10mb',
  verify: (req, res, buffer) => {
    // Store raw body for webhook verification if needed
    (req as any).rawBody = buffer;
  },
});

export const urlencodedMiddleware = express.urlencoded({
  extended: true,
  limit: '10mb',
});

// Apply all middleware
export function setupMiddleware(app: express.Application): void {
  // Security and basics
  app.use(securityMiddleware);
  app.use(corsMiddleware);
  app.use(compressionMiddleware);
  app.use(jsonMiddleware);
  app.use(urlencodedMiddleware);

  // Logging
  app.use(requestLogger);

  // Rate limiting (skip for health check)
  app.use('/api', rateLimitMiddleware);

  // Timeout
  app.use(timeoutMiddleware());

  // Health check route
  app.get('/health', healthCheck);

  logger.info('Middleware setup completed');
}