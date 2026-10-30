import rateLimit from 'express-rate-limit';

/**
 * Rate limiter khusus endpoint autentikasi (login, register, reset password).
 * Tujuannya mencegah serangan brute-force: penyerang mencoba ribuan kombinasi
 * email/password dalam waktu singkat.
 *
 * Default: maksimal 10 percobaan per 15 menit per alamat IP.
 * Nilai bisa di-override lewat environment variable.
 */
const windowMs = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '', 10) || 15 * 60 * 1000; // 15 menit
const maxAttempts = parseInt(process.env.AUTH_RATE_LIMIT_MAX || '', 10) || 10;

export const authRateLimiter = rateLimit({
  windowMs,
  max: maxAttempts,
  standardHeaders: true, // Kirim info limit via header `RateLimit-*`
  legacyHeaders: false,
  message: {
    error: 'Terlalu banyak percobaan. Demi keamanan akun, silakan coba lagi setelah beberapa menit.'
  }
});

/**
 * Rate limiter yang lebih ketat untuk operasi sangat sensitif
 * seperti reset password. Maksimal 5 percobaan per jam per IP.
 */
export const sensitiveRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Terlalu banyak permintaan sensitif. Silakan coba lagi dalam satu jam.'
  }
});
