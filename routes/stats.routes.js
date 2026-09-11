import { Router } from 'express';
import { getPrivateStats, getMapLocations, exportCSV, exportXLSX } from '../controllers/stats.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { apiLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

// Apply requireAuth middleware to all stats routes
router.use(requireAuth);

router.get('/:code', apiLimiter, getPrivateStats);
router.get('/:code/map', apiLimiter, getMapLocations);
router.get('/:code/export/csv', apiLimiter, exportCSV);
router.get('/:code/export/xlsx', apiLimiter, exportXLSX);

export default router;
