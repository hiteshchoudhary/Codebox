import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import config from '../utils/config.js';
import logger from '../utils/logger.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { metricsHandler } from './metrics.js';
import routes from './routes/index.js';

const app = express();

// Trust proxy — needed for correct req.ip behind reverse proxies
if (config.trustProxy) {
  app.set('trust proxy', config.trustProxy);
}

// Security middleware
app.use(helmet());

// CORS — restrict via ALLOWED_ORIGINS env var (comma-separated), or allow all if unset
const corsOptions = config.cors.allowedOrigins.length > 0
  ? {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (config.cors.allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
    }
  : {};
app.use(cors(corsOptions));

// Request parsing
app.use(express.json({ limit: config.server.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.server.bodyLimit }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: Date.now() - start,
      ip: req.ip,
    });
  });
  next();
});

// Rate limiting (before auth to protect against brute force)
app.use(rateLimitMiddleware);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Prometheus metrics (no auth required)
app.get('/metrics', metricsHandler);

// Authentication for protected routes
app.use(authMiddleware);

// API routes
app.use('/', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Start the Express server
 */
export function startServer() {
  const port = config.server.port;

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      logger.info(`Server started on port ${port}`);
      logger.info(`Environment: ${config.server.nodeEnv}`);
      resolve(server);
    });
  });
}

export default app;
