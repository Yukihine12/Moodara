import { Router } from 'express';
import { CycleController } from '../controllers/cycle.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Endpoint dilindungi autentikasi JWT
router.get('/', requireAuth, CycleController.getCyclesAndPredictions);
router.post('/', requireAuth, CycleController.manageCycle);

export default router;
