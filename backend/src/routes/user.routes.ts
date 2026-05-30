import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Endpoint yang dilindungi autentikasi JWT
router.post('/onboard', requireAuth, UserController.onboard);
router.get('/profile', requireAuth, UserController.getProfile);

export default router;
