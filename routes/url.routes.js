import { Router } from 'express';
import { shortenLink, getUserLinks, deleteLink, updateLink, unlockLink } from '../controllers/url.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { createLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

router.post('/shorten', createLimiter, shortenLink);
router.get('/user/links', requireAuth, getUserLinks);
router.delete('/links/:code', requireAuth, deleteLink);
router.put('/links/:code', requireAuth, updateLink);
router.post('/unlock/:code', unlockLink);

export default router;
