import { Router } from 'express';
import { getPrivateStats, getMapLocations, exportCSV, exportXLSX } from '../controllers/stats.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply requireAuth middleware to all stats routes
router.use(requireAuth);

router.get('/:code', getPrivateStats);
router.get('/:code/map', getMapLocations);
router.get('/:code/export/csv', exportCSV);
router.get('/:code/export/xlsx', exportXLSX);

export default router;
