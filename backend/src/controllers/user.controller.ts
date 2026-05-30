import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export class UserController {
  /**
   * Post onboarding data to users
   */
  static async onboard(req: AuthenticatedRequest, res: Response): Promise<any> {
    const connection = await pool.getConnection();
    try {
      const userId = req.userId;
      const { name, birth_date, height, weight, last_period_date, avg_cycle_length } = req.body;

      if (!name || !birth_date || !last_period_date) {
        connection.release();
        return res.status(400).json({ error: 'Nama, tanggal lahir, dan tanggal haid terakhir wajib diisi.' });
      }

      // Simpan data profil menggunakan upsert (ON DUPLICATE KEY UPDATE)
      await connection.execute(
        `INSERT INTO users (id, name, birth_date, height, weight, last_period_date, avg_cycle_length)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           name = VALUES(name), 
           birth_date = VALUES(birth_date),
           height = VALUES(height),
           weight = VALUES(weight),
           last_period_date = VALUES(last_period_date),
           avg_cycle_length = VALUES(avg_cycle_length)`,
        [userId as string, name, birth_date, height || null, weight || null, last_period_date, avg_cycle_length || 28]
      );

      // Cek apakah ada siklus sebelumnya
      const [existingCycles] = await connection.execute(
        'SELECT id FROM cycles WHERE user_id = ?',
        [userId as string]
      ) as any[];

      if (existingCycles.length === 0) {
        // Buat siklus pertama yang sudah selesai (default 6 hari) agar tidak langsung berstatus 'haid aktif berlangsung'
        const newCycleId = uuidv4();
        await connection.execute(
          'INSERT INTO cycles (id, user_id, start_date, end_date, period_duration) VALUES (?, ?, ?, DATE_ADD(?, INTERVAL 5 DAY), 6)',
          [newCycleId, userId as string, last_period_date, last_period_date]
        );
      }

      // Ambil profil yang sudah tersimpan
      const [updatedProfileRows] = await connection.execute(
        'SELECT * FROM users WHERE id = ? LIMIT 1',
        [userId as string]
      ) as any[];

      connection.release();
      return res.status(201).json({
        message: 'Onboarding berhasil disimpan',
        user: updatedProfileRows[0]
      });
    } catch (err: any) {
      connection.release();
      console.error('Onboard controller error:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan sistem saat onboarding.' });
    }
  }

  /**
   * Mendapatkan profil user aktif
   */
  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<any> {
    try {
      const userId = req.userId;

      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE id = ? LIMIT 1',
        [userId as string]
      ) as any[];

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Profil pengguna tidak ditemukan.' });
      }

      return res.status(200).json(rows[0]);
    } catch (err: any) {
      console.error('GetProfile controller error:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan sistem saat mengambil profil.' });
    }
  }
}
