import { Router } from 'express';
import { register, login, logout, getStatus, getMe, forgotPassword, resetPassword } from '../controllers/auth.controller.js';
import { authLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/status', getStatus);
router.get('/me', getMe);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

export default router;
