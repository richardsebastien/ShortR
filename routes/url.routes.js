import { Router } from 'express';
import { shortenLink, getUserLinks, deleteLink, updateLink, unlockLink } from '../controllers/url.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { createLimiter, apiLimiter, authLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

router.post('/shorten', createLimiter, shortenLink);
router.get('/user/links', requireAuth, apiLimiter, getUserLinks);
router.delete('/links/:code', requireAuth, apiLimiter, deleteLink);
router.put('/links/:code', requireAuth, apiLimiter, updateLink);
router.post('/unlock/:code', authLimiter, unlockLink);

export default router;
