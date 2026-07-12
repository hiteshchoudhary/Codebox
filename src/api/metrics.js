import client from 'prom-client';
import { getQueueStats, getWorkerStats } from '../queue/producer.js';

// Create a Registry
const register = new client.Registry();

// Default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics
const queueSize = new client.Gauge({
  name: 'codebox_queue_size',
  help: 'Number of submissions waiting in queue',
  registers: [register],
});

const activeWorkers = new client.Gauge({
  name: 'codebox_workers_active',
  help: 'Number of active workers processing submissions',
  registers: [register],
});

const queueProcessing = new client.Gauge({
  name: 'codebox_queue_processing',
  help: 'Number of submissions currently being processed',
  registers: [register],
});

const queueCompleted = new client.Gauge({
  name: 'codebox_queue_completed',
  help: 'Total completed submissions in queue',
  registers: [register],
});

const queueFailed = new client.Gauge({
  name: 'codebox_queue_failed',
  help: 'Total failed submissions in queue',
  registers: [register],
});

// Update queue metrics before each scrape
register.setDefaultLabels({ service: 'codebox' });

async function updateQueueMetrics() {
  try {
    const stats = await getQueueStats();
    queueSize.set(stats.submissions.in_queue);
    queueProcessing.set(stats.submissions.processing);
    queueCompleted.set(stats.submissions.completed);
    queueFailed.set(stats.submissions.failed);

    const workers = await getWorkerStats();
    activeWorkers.set(workers.length);
  } catch {
    // Queue might not be ready yet
  }
}

export async function metricsHandler(req, res) {
  await updateQueueMetrics();
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

export default { metricsHandler };
