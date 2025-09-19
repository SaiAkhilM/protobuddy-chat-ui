import express from 'express';
import { config, isDevelopment } from './config';
import { logger } from './utils/logger';
import { setupMiddleware, errorHandler, notFoundHandler } from './middleware';
import { initializeConnections, closeConnections } from './database/connection';
import apiRoutes from './routes';

const app = express();

// Setup middleware
setupMiddleware(app);

// API routes
app.use('/api', apiRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer(): Promise<void> {
  try {
    // Initialize database connections
    await initializeConnections();

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`ProtoBuddy backend server started`, {
        port: config.port,
        env: config.env,
        corsOrigin: config.corsOrigin,
      });

      if (isDevelopment()) {
        logger.info('Development mode active - API keys may be missing');
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');

      server.close(async () => {
        await closeConnections();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');

      server.close(async () => {
        await closeConnections();
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();