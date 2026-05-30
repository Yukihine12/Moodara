import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dns from 'node:dns';
import { env } from './config/env.js';

// Force DNS resolution to prefer IPv4 first, preventing connection timeouts on Windows environments
dns.setDefaultResultOrder('ipv4first');

// Import Routes
import authRouter from './routes/auth.routes.js';
import userRouter from './routes/user.routes.js';
import cycleRouter from './routes/cycle.routes.js';
import logRouter from './routes/log.routes.js';
import aiRouter from './routes/ai.routes.js';

const app = express();
const PORT = env.PORT || 3001;

// Configuration Middleware
app.use(cors({
  origin: env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Logger sederhana
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    platform: 'Google Cloud Run'
  });
});

// Register API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/cycles', cycleRouter);
app.use('/api/logs', logRouter);
app.use('/api/ai', aiRouter);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.url} tidak ditemukan.` });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: 'Terjadi kesalahan sistem internal pada server Express.',
    message: err.message || 'Unknown error'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Moodara Backend running on port ${PORT}`);
  console.log(`📡 CORS allowed for: ${env.FRONTEND_URL}`);
  console.log(`====================================================`);
});
