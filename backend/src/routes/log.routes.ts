import { Router } from 'express';
import { LogController } from '../controllers/log.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Endpoint dilindungi autentikasi JWT
router.get('/', requireAuth, LogController.getLogByDate);
router.post('/', requireAuth, LogController.saveLog);
router.get('/range', requireAuth, LogController.getLogsRange);

export default router;
