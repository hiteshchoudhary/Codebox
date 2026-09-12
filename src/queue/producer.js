import { Queue } from 'bullmq';
import Redis from 'ioredis';
import config from '../utils/config.js';
import logger from '../utils/logger.js';

// Redis connection
let redis = null;
let submissionQueue = null;

/**
 * Initialize Redis and BullMQ queue
 */
export async function initializeQueue() {
  redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
  });

  redis.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
  });

  redis.on('connect', () => {
    logger.info('Connected to Redis');
  });

  submissionQueue = new Queue('submissions', {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        count: 100,
      },
      removeOnFail: {
        count: 1000,
      },
    },
  });

  logger.info('BullMQ queue initialized');
  return submissionQueue;
}

/**
 * Get Redis connection
 */
export function getRedis() {
  return redis;
}

/**
 * Get submission queue
 */
export function getQueue() {
  return submissionQueue;
}

/**
 * Add submission to queue and cache
 */
export async function addSubmission(submission) {
  if (!redis || !submissionQueue) {
    throw new Error('Queue not initialized');
  }

  // Store initial submission state in Redis
  await redis.setex(
    `submission:${submission.token}`,
    config.cache.resultTtl,
    JSON.stringify(submission)
  );

  // Add job to queue
  await submissionQueue.add('execute', submission, {
    jobId: submission.token,
  });

  logger.debug({
    event: 'submission_queued',
    token: submission.token,
  });

  return submission;
}

/**
 * Get submission from cache
 */
export async function getSubmission(token) {
  if (!redis) {
    throw new Error('Redis not initialized');
  }

  const data = await redis.get(`submission:${token}`);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    logger.error({ event: 'corrupted_submission', token });
    return null;
  }
}

/**
 * Update submission in cache
 */
export async function updateSubmission(token, updates) {
  if (!redis) {
    throw new Error('Redis not initialized');
  }

  const existing = await getSubmission(token);
  if (!existing) return null;

  const updated = { ...existing, ...updates };

  await redis.setex(
    `submission:${token}`,
    config.cache.resultTtl,
    JSON.stringify(updated)
  );

  return updated;
}

/**
 * Delete submission from cache
 */
export async function deleteSubmission(token) {
  if (!redis) {
    throw new Error('Redis not initialized');
  }

  const exists = await redis.exists(`submission:${token}`);
  if (!exists) return false;

  await redis.del(`submission:${token}`);
  return true;
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  if (!submissionQueue) {
    return { submissions: { total: 0, in_queue: 0, processing: 0, completed: 0 } };
  }

  const [waiting, active, completed, failed] = await Promise.all([
    submissionQueue.getWaitingCount(),
    submissionQueue.getActiveCount(),
    submissionQueue.getCompletedCount(),
    submissionQueue.getFailedCount(),
  ]);

  return {
    submissions: {
      total: waiting + active + completed + failed,
      in_queue: waiting,
      processing: active,
      completed: completed,
      failed: failed,
    },
  };
}

/**
 * Get worker statistics
 */
export async function getWorkerStats() {
  if (!submissionQueue) {
    return [];
  }

  const workers = await submissionQueue.getWorkers();
  return workers.map(w => ({
    id: w.id,
    name: w.name,
    active: true,
  }));
}

/**
 * Close Redis connection
 */
export async function closeQueue() {
  if (submissionQueue) {
    await submissionQueue.close();
  }
  if (redis) {
    await redis.quit();
  }
  logger.info('Queue connections closed');
}

export default {
  initializeQueue,
  getRedis,
  getQueue,
  addSubmission,
  getSubmission,
  updateSubmission,
  deleteSubmission,
  getQueueStats,
  getWorkerStats,
  closeQueue,
};
