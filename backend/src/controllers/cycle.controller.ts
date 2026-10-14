import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import pool from '../config/db.js';
import { CycleService, differenceInDays } from '../services/cycle.service.js';
import { v4 as uuidv4 } from 'uuid';

export class CycleController {
  /**
   * Mengambil riwayat siklus + hasil kalkulasi prediksi
   */
  static async getCyclesAndPredictions(req: AuthenticatedRequest, res: Response): Promise<any> {
    try {
      const userId = req.userId;

      const { rows: profiles } = await pool.query(
        'SELECT avg_cycle_length, last_period_date FROM users WHERE id = $1 LIMIT 1',
        [userId as string]
      );

      if (profiles.length === 0) {
        return res.status(404).json({ error: 'Profil pengguna belum disetup. Lakukan onboarding terlebih dahulu.' });
      }
      const userProfile = profiles[0];

      const { rows: cycles } = await pool.query(
        'SELECT * FROM cycles WHERE user_id = $1 ORDER BY start_date ASC',
        [userId as string]
      );

      const prediction = CycleService.predictNextCycle(
        cycles,
        userProfile.avg_cycle_length,
        userProfile.last_period_date
      );

      return res.status(200).json({
        history: cycles,
        prediction
      });
    } catch (err: any) {
      console.error('GetCyclesAndPredictions controller error:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan sistem saat memproses siklus.' });
    }
  }

  /**
   * Menyimpan siklus baru (START_PERIOD) atau menyelesaikan siklus berjalan (END_PERIOD)
   */
  static async manageCycle(req: AuthenticatedRequest, res: Response): Promise<any> {
    try {
      const userId = req.userId;
      const { action, date } = req.body; 

      if (!action || !date) {
        return res.status(400).json({ error: 'Action dan tanggal wajib diisi.' });
      }

      if (action === 'START_PERIOD') {
        const { rows: activeCycleRows } = await pool.query(
          'SELECT * FROM cycles WHERE user_id = $1 AND end_date IS NULL ORDER BY start_date DESC LIMIT 1',
          [userId as string]
        );

        if (activeCycleRows.length > 0) {
          const prevCycle = activeCycleRows[0];
          const cycleLength = differenceInDays(date, prevCycle.start_date);
          
          if (cycleLength <= 0) {
            return res.status(400).json({ error: 'Tanggal mulai haid baru harus lebih lambat dari tanggal mulai haid sebelumnya.' });
          }

          await pool.query(
            'UPDATE cycles SET cycle_length = $1 WHERE id = $2',
            [cycleLength, prevCycle.id]
          );
        }

        if (activeCycleRows.length === 0) {
          const { rows: lastClosedCycleRows } = await pool.query(
            'SELECT * FROM cycles WHERE user_id = $1 AND end_date IS NOT NULL ORDER BY start_date DESC LIMIT 1',
            [userId as string]
          );

          if (lastClosedCycleRows.length > 0) {
            const closedCycle = lastClosedCycleRows[0];
            const cycleLength = differenceInDays(date, closedCycle.start_date);
            if (cycleLength > 0) {
              await pool.query(
                'UPDATE cycles SET cycle_length = $1 WHERE id = $2',
                [cycleLength, closedCycle.id]
              );
            }
          }
        }

        const newCycleId = uuidv4();
        await pool.query(
          'INSERT INTO cycles (id, user_id, start_date) VALUES ($1, $2, $3)',
          [newCycleId, userId as string, date]
        );

        await pool.query(
          'UPDATE users SET last_period_date = $1 WHERE id = $2',
          [date, userId as string]
        );

        const { rows: newInsertedCycle } = await pool.query(
          'SELECT * FROM cycles WHERE id = $1 LIMIT 1',
          [newCycleId]
        );

        return res.status(201).json({
          message: 'Haid berhasil dicatat dimulai!',
          cycle: newInsertedCycle[0]
        });

      } else if (action === 'END_PERIOD') {
        const { rows: activeCycleRows } = await pool.query(
          'SELECT * FROM cycles WHERE user_id = $1 AND end_date IS NULL ORDER BY start_date DESC LIMIT 1',
          [userId as string]
        );

        if (activeCycleRows.length === 0) {
          return res.status(400).json({ error: 'Tidak ada siklus haid aktif yang terdeteksi berjalan. Silakan tap haid mulai terlebih dahulu.' });
        }

        const currentCycle = activeCycleRows[0];
        let periodDuration = differenceInDays(date, currentCycle.start_date) + 1;

        if (periodDuration <= 0) {
          return res.status(400).json({ error: 'Tanggal selesai haid harus lebih lambat atau sama dengan tanggal mulai.' });
        }

        let end_date = date;
        if (periodDuration > 15) {
          console.warn(`⚠️ ALERT: Haid terdeteksi ${periodDuration} hari. Menandai anomali medis.`);
          if (periodDuration > 20) {
            periodDuration = 20;
          }
        }

        await pool.query(
          'UPDATE cycles SET end_date = $1, period_duration = $2 WHERE id = $3',
          [end_date, periodDuration, currentCycle.id]
        );

        const { rows: updatedCycleRows } = await pool.query(
          'SELECT * FROM cycles WHERE id = $1 LIMIT 1',
          [currentCycle.id]
        );

        return res.status(200).json({
          message: 'Haid berhasil dicatat selesai!',
          cycle: updatedCycleRows[0]
        });

      } else {
        return res.status(400).json({ error: 'Action tidak dikenal. Gunakan START_PERIOD atau END_PERIOD.' });
      }
    } catch (err: any) {
      console.error('ManageCycle controller error:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan sistem saat memperbarui siklus.' });
    }
  }
}
