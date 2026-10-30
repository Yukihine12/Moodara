import { Router } from 'express';
import { login, register, changePassword } from '../controllers/auth.controller.js';
import { authRateLimiter, sensitiveRateLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

// Endpoint autentikasi dilindungi rate limiter untuk mencegah brute-force
router.post('/login', authRateLimiter, login);
router.post('/register', authRateLimiter, register);

// Ganti password wajib verifikasi password lama + rate limit ketat
router.post('/change-password', sensitiveRateLimiter, changePassword);

export default router;
