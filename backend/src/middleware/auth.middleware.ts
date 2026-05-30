import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Header Otorisasi hilang atau memiliki format yang salah' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      if (!decoded.userId) {
        throw new Error('Payload token tidak valid (userId hilang)');
      }
      req.userId = decoded.userId;
      next();
    } catch (err: any) {
      console.warn('⚠️ Blokir Akses: Token JWT ditolak atau kadaluarsa.');
      return res.status(401).json({ error: 'Sesi otorisasi kadaluarsa atau tidak valid. Silakan masuk ulang.' });
    }
  } catch (err: any) {
    console.error('Error Auth Middleware:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan sistem pada lapisan keamanan.' });
  }
}
