import { Router } from 'express';
import { healthcheck, getQRCode, resolveRedirect } from '../controllers/redirect.controller.js';
import { apiLimiter, redirectionLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

router.get('/health', healthcheck);
router.get('/qr/:code.png', apiLimiter, getQRCode);
router.get('/:code', redirectionLimiter, resolveRedirect);

export default router;
