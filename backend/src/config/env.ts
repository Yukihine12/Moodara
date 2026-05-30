import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: process.env.PORT || '3001',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'moodara_db',
  DB_PORT: process.env.DB_PORT || '3306',
  JWT_SECRET: process.env.JWT_SECRET || 'secret',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || ''
};

// Validasi sederhana
if (!env.DB_HOST || !env.DB_PASSWORD) {
  console.warn('⚠️ WARNING: DB_HOST atau DB_PASSWORD belum terkonfigurasi di env!');
}
if (!env.GEMINI_API_KEY) {
  console.warn('⚠️ WARNING: GEMINI_API_KEY belum terkonfigurasi di env!');
}
