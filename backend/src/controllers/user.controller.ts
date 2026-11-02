import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { validateOnboardingPayload, validateWeightUpdate, RANGES } from '../lib/validation.js';

/**
 * Satu baris riwayat pengukuran tubuh (berat/tinggi) untuk grafik time-series
 * di Halaman Akun (Req 6). `recorded_at` berformat YYYY-MM-DD.
 */
export interface Measurement {
  id: string;
  user_id: string;
  type: 'weight' | 'height';
  value: number;
  recorded_at: string;
}

export class UserController {
  /**
   * Post onboarding data to users
   */
  static async onboard(req: AuthenticatedRequest, res: Response): Promise<any> {
    try {
      const userId = req.userId;
      const { name, birth_date, height, weight, last_period_date, avg_cycle_length, avg_period_duration } = req.body;

      // Lapis 2 (Backend): tolak payload tidak valid SEBELUM menyentuh DB.
      // Validator murni mengembalikan daftar field yang gagal (kosong = valid),
      // sehingga nilai di luar rentang menghasilkan 400 (bukan 500 dari CHECK DB).
      const fields = validateOnboardingPayload(req.body);
      if (fields.length > 0) {
        return res.status(400).json({
          error: 'Data onboarding tidak valid. Periksa kembali field yang ditandai.',
          fields,
        });
      }

      if (!name || !birth_date || !last_period_date) {
        return res.status(400).json({ error: 'Nama, tanggal lahir, dan tanggal haid terakhir wajib diisi.' });
      }

      // Normalisasi nilai yang sudah tervalidasi ke rentang kanonik dengan default.
      // avg_period_duration (durasi haid) disimpan ke profil dan dipakai sebagai
      // period_duration siklus awal agar mencerminkan pilihan pengguna (Req 4.4).
      const cycleLength = avg_cycle_length ?? 28;
      const periodDuration = avg_period_duration ?? 7;

      // Simpan data profil menggunakan upsert PostgreSQL (ON CONFLICT DO UPDATE).
      // Menyimpan tinggi/berat tervalidasi, avg_cycle_length, dan avg_period_duration;
      // field name & birth_date dipertahankan (Req 4.1, 4.4).
      await pool.query(
        `INSERT INTO users (id, name, birth_date, height, weight, last_period_date, avg_cycle_length, avg_period_duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET 
           name = EXCLUDED.name, 
           birth_date = EXCLUDED.birth_date,
           height = EXCLUDED.height,
           weight = EXCLUDED.weight,
           last_period_date = EXCLUDED.last_period_date,
           avg_cycle_length = EXCLUDED.avg_cycle_length,
           avg_period_duration = EXCLUDED.avg_period_duration,
           updated_at = CURRENT_TIMESTAMP`,
        [userId as string, name, birth_date, height, weight, last_period_date, cycleLength, periodDuration]
      );

      // Cek apakah ada siklus sebelumnya
      const { rows: existingCycles } = await pool.query(
        'SELECT id FROM cycles WHERE user_id = $1',
        [userId as string]
      );

      if (existingCycles.length === 0) {
        // Buat siklus pertama yang sudah selesai agar tidak langsung berstatus 'haid aktif berlangsung'.
        // period_duration = avg_period_duration pengguna; end_date = start_date + (durasi - 1) hari
        // sehingga rentang mencakup tepat `periodDuration` hari kalender dan selalu end_date >= start_date
        // (patuh CHECK check_cycle_dates). start_date = last_period_date menjaga UNIQUE (user_id, start_date).
        const newCycleId = uuidv4();
        await pool.query(
          `INSERT INTO cycles (id, user_id, start_date, end_date, period_duration) 
           VALUES ($1, $2, $3, ($3::date + make_interval(days => $4 - 1)), $4)`,
          [newCycleId, userId as string, last_period_date, periodDuration]
        );

        // Catat entri awal ke body_measurements (tinggi + berat) sebagai titik awal
        // grafik time-series di Halaman Akun (Req 6.7). recorded_at = last_period_date.
        // Di-gate pada onboarding pertama (bersama pembuatan siklus awal) agar
        // resubmit idempoten (Req 4.7): tidak menambah titik pengukuran duplikat
        // yang akan mengotori grafik, dan tidak bergantung pada constraint apa pun.
        await pool.query(
          `INSERT INTO body_measurements (id, user_id, type, value, recorded_at)
           VALUES ($1, $2, 'height', $3, $4), ($5, $2, 'weight', $6, $4)`,
          [uuidv4(), userId as string, height, last_period_date, uuidv4(), weight]
        );
      }

      // Ambil profil yang sudah tersimpan
      const { rows: updatedProfileRows } = await pool.query(
        'SELECT * FROM users WHERE id = $1 LIMIT 1',
        [userId as string]
      );

      return res.status(201).json({
        message: 'Onboarding berhasil disimpan',
        user: updatedProfileRows[0]
      });
    } catch (err: any) {
      console.error('Onboard controller error:', err);

      // Petakan error driver PostgreSQL (pg) ke status informatif (Req 4.6).
      // Objek error pg mengekspos `.code` (SQLSTATE), dan sering `.constraint`
      // serta `.detail`. Pelanggaran constraint data = kesalahan input (400),
      // bukan kegagalan sistem (500). Jaring pengaman terakhir setelah validasi
      // Lapis 2; secara normal nilai di luar rentang sudah ditolak lebih awal.
      const pgErr = err as { code?: string; constraint?: string; detail?: string };

      switch (pgErr.code) {
        case '23514': {
          // CHECK constraint violation -> sebut constraint & rentang valid bila dikenal.
          const checkMessages: Record<string, string> = {
            users_height_check: `Tinggi badan harus antara ${RANGES.height.min} dan ${RANGES.height.max} ${RANGES.height.unit}.`,
            users_weight_check: `Berat badan harus antara ${RANGES.weight.min} dan ${RANGES.weight.max} ${RANGES.weight.unit}.`,
            users_avg_cycle_length_check: `Panjang siklus harus antara ${RANGES.cycleLength.min} dan ${RANGES.cycleLength.max} hari.`,
            users_avg_period_duration_check: `Durasi haid harus antara ${RANGES.periodDuration.min} dan ${RANGES.periodDuration.max} hari.`,
            cycles_cycle_length_check: `Panjang siklus harus antara ${RANGES.cycleLength.min} dan ${RANGES.cycleLength.max} hari.`,
            cycles_period_duration_check: `Durasi haid harus antara ${RANGES.periodDuration.min} dan ${RANGES.periodDuration.max} hari.`,
            check_cycle_dates: 'Tanggal selesai siklus tidak boleh lebih awal dari tanggal mulai.',
          };
          const message =
            (pgErr.constraint && checkMessages[pgErr.constraint]) ||
            'Salah satu nilai berada di luar rentang yang diizinkan. Periksa kembali data yang dimasukkan.';
          return res.status(400).json({ error: message, constraint: pgErr.constraint });
        }

        case '23505':
          // Unique violation. Dengan gating `existingCycles`, resubmit onboarding
          // tidak seharusnya mencapai sini (Req 4.7); bila terjadi, tetap balas
          // 400 informatif alih-alih 500 generik.
          return res.status(400).json({
            error: 'Data sudah pernah tersimpan sebelumnya dan tidak dapat diduplikasi.',
            constraint: pgErr.constraint,
          });

        case '23502':
          // Not null violation -> field wajib tidak boleh kosong.
          return res.status(400).json({
            error: 'Ada field wajib yang kosong. Pastikan nama, tinggi, berat, dan tanggal haid terakhir terisi.',
            constraint: pgErr.constraint,
          });

        default:
          return res.status(500).json({ error: 'Terjadi kesalahan sistem saat onboarding.' });
      }
    }
  }

  /**
   * Mendapatkan profil user aktif
   */
  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<any> {
    try {
      const userId = req.userId;

      const { rows } = await pool.query(
        'SELECT * FROM users WHERE id = $1 LIMIT 1',
        [userId as string]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Profil pengguna tidak ditemukan.' });
      }

      return res.status(200).json(rows[0]);
    } catch (err: any) {
      console.error('GetProfile controller error:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan sistem saat mengambil profil.' });
    }
  }

  /**
   * Mengambil riwayat pengukuran tubuh pengguna untuk grafik Halaman Akun.
   * GET /api/users/measurements -> { height: Measurement[], weight: Measurement[] }
   *
   * Kedua array terurut `recorded_at` ASC (terlama -> terbaru) agar grafik
   * time-series tidak perlu mengurutkan ulang di frontend (Req 6.2, 6.3).
   */
  static async getMeasurements(req: AuthenticatedRequest, res: Response): Promise<any> {
    try {
      const userId = req.userId;

      const { rows } = await pool.query(
        `SELECT id, user_id, type, value, recorded_at
         FROM body_measurements
         WHERE user_id = $1
         ORDER BY recorded_at ASC`,
        [userId as string]
      );

      const height: Measurement[] = [];
      const weight: Measurement[] = [];
      for (const row of rows as Measurement[]) {
        if (row.type === 'height') {
          height.push(row);
        } else if (row.type === 'weight') {
          weight.push(row);
        }
      }

      return res.status(200).json({ height, weight });
    } catch (err: any) {
      console.error('GetMeasurements controller error:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan sistem saat mengambil riwayat pengukuran.' });
    }
  }

  /**
   * Menambah entri berat badan baru ke riwayat dan menyinkronkan profil.
   * POST /api/users/measurements/weight  body: { weight: number }
   *
   * Validasi Lapis 2 (Backend) wajib: payload tidak valid ditolak dengan 400
   * tanpa menyentuh DB (Req 6.5). Bila valid: INSERT baris `body_measurements`
   * tipe `weight` dengan `recorded_at = CURRENT_DATE`, lalu update `users.weight`
   * ke nilai terbaru; balas 201 (Req 6.4).
   */
  static async addWeight(req: AuthenticatedRequest, res: Response): Promise<any> {
    try {
      const userId = req.userId;

      // Lapis 2: tolak nilai tidak valid SEBELUM menyentuh DB (Req 6.5).
      const fields = validateWeightUpdate(req.body);
      if (fields.length > 0) {
        return res.status(400).json({
          error: 'Berat badan tidak valid. Periksa kembali nilai yang dimasukkan.',
          fields,
        });
      }

      const { weight } = req.body;

      // INSERT entri riwayat baru. recorded_at = CURRENT_DATE (Req 6.4).
      const measurementId = uuidv4();
      const { rows: inserted } = await pool.query(
        `INSERT INTO body_measurements (id, user_id, type, value, recorded_at)
         VALUES ($1, $2, 'weight', $3, CURRENT_DATE)
         RETURNING id, user_id, type, value, recorded_at`,
        [measurementId, userId as string, weight]
      );

      // Sinkronkan nilai berat terbaru ke profil pengguna.
      await pool.query(
        `UPDATE users SET weight = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [weight, userId as string]
      );

      return res.status(201).json({
        message: 'Berat badan berhasil disimpan.',
        measurement: inserted[0] as Measurement,
      });
    } catch (err: any) {
      console.error('AddWeight controller error:', err);

      // Jaring pengaman: petakan pelanggaran constraint data ke 400 (Req 6.5),
      // selaras dengan pemetaan error pada onboard.
      const pgErr = err as { code?: string; constraint?: string };
      switch (pgErr.code) {
        case '23514':
          return res.status(400).json({
            error: `Berat badan harus antara ${RANGES.weight.min} dan ${RANGES.weight.max} ${RANGES.weight.unit}.`,
            constraint: pgErr.constraint,
          });
        case '23502':
          return res.status(400).json({
            error: 'Berat badan wajib diisi.',
            constraint: pgErr.constraint,
          });
        default:
          return res.status(500).json({ error: 'Terjadi kesalahan sistem saat menyimpan berat badan.' });
      }
    }
  }
}
