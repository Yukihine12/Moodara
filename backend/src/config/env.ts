import dotenv from 'dotenv';
dotenv.config();

/**
 * Helper: ambil environment variable wajib.
 * Jika tidak ada, aplikasi langsung berhenti (fail-fast) agar tidak pernah
 * berjalan diam-diam memakai nilai rahasia default yang tidak aman.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `❌ Environment variable "${key}" wajib diisi tetapi tidak ditemukan. ` +
      `Periksa file .env Anda (lihat .env.example sebagai acuan).`
    );
  }
  return value;
}

/**
 * Helper: ambil environment variable opsional dengan nilai default
 * yang AMAN (bukan rahasia/kredensial).
 */
function optionalEnv(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim() !== '' ? value : fallback;
}

export const env = {
  // Konfigurasi non-rahasia boleh memiliki default yang aman
  PORT: optionalEnv('PORT', '3001'),
  FRONTEND_URL: optionalEnv('FRONTEND_URL', 'http://localhost:5173'),
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  DB_PORT: optionalEnv('DB_PORT', '5432'),
  DB_SSL: optionalEnv('DB_SSL', 'false'),

  // Kredensial & rahasia TIDAK boleh punya default — wajib dari .env
  DB_HOST: requireEnv('DB_HOST'),
  DB_USER: requireEnv('DB_USER'),
  DB_PASSWORD: requireEnv('DB_PASSWORD'),
  DB_NAME: requireEnv('DB_NAME'),
  JWT_SECRET: requireEnv('JWT_SECRET')
};

// Peringatan tambahan: JWT_SECRET yang terlalu pendek rawan di-brute force
if (env.JWT_SECRET.length < 32) {
  console.warn(
    '⚠️ WARNING: JWT_SECRET sebaiknya minimal 32 karakter acak untuk keamanan. ' +
    'Gunakan perintah seperti: openssl rand -base64 48'
  );
}
