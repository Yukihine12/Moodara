import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import pool from '../config/db.js';
import { CycleService } from '../services/cycle.service.js';
import { v4 as uuidv4 } from 'uuid';

export class LogController {
  /**
   * Mengambil log harian user berdasarkan tanggal dan menghitung fasenya secara dinamis
   */
  static async getLogByDate(req: AuthenticatedRequest, res: Response): Promise<any> {
    try {
      const userId = req.userId;
      const dateStr = req.query.date as string;

      if (!dateStr) {
        return res.status(400).json({ error: 'Parameter tanggal (date) wajib disertakan.' });
      }

      // 1. Ambil data profil
      const [profiles] = await pool.execute(
        'SELECT avg_cycle_length, last_period_date FROM users WHERE id = ? LIMIT 1',
        [userId as string]
      ) as any[];

      if (profiles.length === 0) {
        return res.status(404).json({ error: 'Profil pengguna tidak ditemukan.' });
      }
      const userProfile = profiles[0];

      // 2. Ambil siklus
      const [cycles] = await pool.execute(
        'SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date ASC',
        [userId as string]
      ) as any[];

      // 3. Prediksi
      const prediction = CycleService.predictNextCycle(
        cycles,
        userProfile.avg_cycle_length,
        userProfile.last_period_date
      );

      // 4. Ambil log harian
      const [logs] = await pool.execute(
        'SELECT * FROM daily_logs WHERE user_id = ? AND log_date = ? LIMIT 1',
        [userId as string, dateStr]
      ) as any[];

      // 5. Kalkulasi fase dinamis
      const calculatedPhase = CycleService.calculatePhaseForDate(
        dateStr,
        cycles,
        prediction
      );

      return res.status(200).json({
        log: logs.length > 0 ? logs[0] : null,
        calculated_phase: calculatedPhase
      });
    } catch (err: any) {
      console.error('GetLogByDate controller error:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan sistem saat mengambil log harian.' });
    }
  }

  /**
   * Menyimpan atau mengupdate log harian (Flow, Mood, Pain, Energy, Notes)
   */
  static async saveLog(req: AuthenticatedRequest, res: Response): Promise<any> {
    try {
      const userId = req.userId;
      const { log_date, flow_intensity, mood, pain_level, energy_level, notes } = req.body;

      if (!log_date) {
        return res.status(400).json({ error: 'Tanggal log (log_date) wajib diisi.' });
      }

      const targetDate = new Date(log_date);
      const today = new Date(new Date().toISOString().split('T')[0]);
      if (targetDate > today) {
        return res.status(400).json({ error: 'Anda tidak bisa mencatat gejala untuk tanggal di masa depan.' });
      }

      const logId = uuidv4();
      const moodJson = JSON.stringify(mood || []);

      await pool.execute(
        `INSERT INTO daily_logs (id, user_id, log_date, flow_intensity, mood, pain_level, energy_level, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           flow_intensity = VALUES(flow_intensity),
           mood = VALUES(mood),
           pain_level = VALUES(pain_level),
           energy_level = VALUES(energy_level),
           notes = VALUES(notes)`,
        [logId, userId as string, log_date, flow_intensity || 'none', moodJson, pain_level || null, energy_level || null, notes || null]
      );

      const [updatedLog] = await pool.execute(
        'SELECT * FROM daily_logs WHERE user_id = ? AND log_date = ? LIMIT 1',
        [userId as string, log_date]
      ) as any[];

      return res.status(200).json({
        message: 'Log harian berhasil disimpan',
        log: updatedLog[0]
      });
    } catch (err: any) {
      console.error('SaveLog controller error:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan sistem saat menyimpan log.' });
    }
  }

  /**
   * Mengambil logs berdasarkan rentang tanggal dan menghitung fase dinamisnya
   */
  static async getLogsRange(req: AuthenticatedRequest, res: Response): Promise<any> {
    try {
      const userId = req.userId;
      const { from, to } = req.query;

      if (!from || !to) {
        return res.status(400).json({ error: 'Parameter rentang tanggal (from & to) wajib diisi.' });
      }

      const [profiles] = await pool.execute(
        'SELECT avg_cycle_length, last_period_date FROM users WHERE id = ? LIMIT 1',
        [userId as string]
      ) as any[];

      if (profiles.length === 0) {
        return res.status(404).json({ error: 'Profil pengguna tidak ditemukan.' });
      }
      const userProfile = profiles[0];

      const [cycles] = await pool.execute(
        'SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date ASC',
        [userId as string]
      ) as any[];

      const prediction = CycleService.predictNextCycle(
        cycles,
        userProfile.avg_cycle_length,
        userProfile.last_period_date
      );

      const [logs] = await pool.execute(
        'SELECT * FROM daily_logs WHERE user_id = ? AND log_date >= ? AND log_date <= ? ORDER BY log_date ASC',
        [userId as string, from as string, to as string]
      ) as any[];

      const logsWithPhases = logs.map((log: any) => {
        const calculatedPhase = CycleService.calculatePhaseForDate(
          log.log_date,
          cycles,
          prediction
        );
        // Konversi string JSON mood menjadi array kembali
        try {
          if (typeof log.mood === 'string') log.mood = JSON.parse(log.mood);
        } catch(e) {}
        
        return {
          ...log,
          calculated_phase: calculatedPhase
        };
      });

      return res.status(200).json({
        logs: logsWithPhases
      });
    } catch (err: any) {
      console.error('GetLogsRange controller error:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan sistem saat memproses rentang log.' });
    }
  }
}
