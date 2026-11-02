import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Endpoint yang dilindungi autentikasi JWT
router.post('/onboard', requireAuth, UserController.onboard);
router.get('/profile', requireAuth, UserController.getProfile);

// Pengukuran tubuh untuk Halaman Akun (Req 6.2, 6.3, 6.4)
router.get('/measurements', requireAuth, UserController.getMeasurements);
router.post('/measurements/weight', requireAuth, UserController.addWeight);

export default router;
