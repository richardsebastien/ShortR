import { Router } from 'express';
import { healthcheck, getQRCode, resolveRedirect } from '../controllers/redirect.controller.js';

const router = Router();

router.get('/health', healthcheck);
router.get('/qr/:code.png', getQRCode);
router.get('/:code', resolveRedirect);

export default router;
