import { Router } from 'express';
import { AiController } from '../controllers/ai.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Endpoint dilindungi autentikasi JWT
router.post('/summary', requireAuth, AiController.getOrCreateMonthlySummary);
router.get('/summary/:monthYear', requireAuth, AiController.getCachedSummary);

export default router;
