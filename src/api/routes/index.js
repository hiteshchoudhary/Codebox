import { Router } from 'express';
import submissionsRouter from './submissions.js';
import languagesRouter from './languages.js';
import systemRouter from './system.js';

const router = Router();

// Submissions endpoints
router.use('/submissions', submissionsRouter);

// Languages endpoint
router.use('/languages', languagesRouter);

// Note: GET /metrics is handled directly in api/server.js (src/api/metrics.js),
// registered before authMiddleware.

// System endpoints (statuses, about, workers, etc.)
router.use('/', systemRouter);

export default router;
