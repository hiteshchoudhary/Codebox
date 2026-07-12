import { startServer } from './api/server.js';
import { initializeQueue, closeQueue } from './queue/producer.js';
import logger from './utils/logger.js';
import config from './utils/config.js';

async function main() {
  logger.info({
    event: 'starting',
    environment: config.server.nodeEnv,
  });

  // Startup security warnings
  if (config.server.nodeEnv === 'production') {
    if (config.auth.tokens.length === 0) {
      logger.warn('AUTH_TOKEN is not set. All endpoints are unprotected.');
    }
    if (config.cors.allowedOrigins.length === 0) {
      logger.warn('ALLOWED_ORIGINS is not set. CORS is wide open.');
    }
    if (!config.trustProxy) {
      logger.warn('TRUST_PROXY is not set. req.ip and rate limiting may be incorrect behind a reverse proxy.');
    }
  }

  try {
    // Initialize Redis and BullMQ queue
    await initializeQueue();
    logger.info('Queue initialized');

    // Start Express server
    const server = await startServer();
    logger.info(`API server started on port ${config.server.port}`);

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info({ signal }, 'Shutdown signal received');

      server.close(async () => {
        logger.info('HTTP server closed');

        await closeQueue();
        logger.info('Queue connections closed');

        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error({ error }, 'Failed to start application');
    process.exit(1);
  }
}

main();
