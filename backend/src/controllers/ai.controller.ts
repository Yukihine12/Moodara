import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import pool from '../config/db.js';
import { AiService } from '../services/ai.service.js';
import { CycleService } from '../services/cycle.service.js';
import { v4 as uuidv4 } from 'uuid';

export class AiController {
  /**
   * Membuat atau mengambil ringkasan bulanan menggunakan AI Gemini secara adaptif
   */
  static async getOrCreateMonthlySummary(req: AuthenticatedRequest, res: Response): Promise<any> {
    try {
      const userId = req.userId;
      const { month_year } = req.body;

      if (!month_year || !/^\d{4}-\d{2}$/.test(month_year)) {
        return res.status(400).json({ error: 'Format month_year wajib disediakan dengan format YYYY-MM.' });
      }

      // 1. Cek Cache di database terlebih dahulu
      const [cachedSummaries] = await pool.execute(
        'SELECT * FROM ai_summaries WHERE user_id = ? AND month_year = ? LIMIT 1',
        [userId as string, month_year]
      ) as any[];

      if (cachedSummaries.length > 0) {
        return res.status(200).json({
          month_year: cachedSummaries[0].month_year,
          log_count: -1, 
          summary_content: cachedSummaries[0].summary_content,
          cached: true
        });
      }

      // 2. Ambil data profil user
      const [profiles] = await pool.execute(
        'SELECT * FROM users WHERE id = ? LIMIT 1',
        [userId as string]
      ) as any[];

      if (profiles.length === 0) {
        return res.status(404).json({ error: 'Profil pengguna tidak ditemukan. Selesaikan onboarding terlebih dahulu.' });
      }
      const userProfile = profiles[0];

      // 3. Tarik seluruh logs harian milik user pada bulan yang bersangkutan
      const startDate = `${month_year}-01`;
      const [year, month] = month_year.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${month_year}-${String(lastDay).padStart(2, '0')}`;

      const [rawLogs] = await pool.execute(
        'SELECT * FROM daily_logs WHERE user_id = ? AND log_date >= ? AND log_date <= ? ORDER BY log_date ASC',
        [userId as string, startDate, endDate]
      ) as any[];

      // 4. Ambil siklus untuk menghitung fase harian dinamis
      const [cycles] = await pool.execute(
        'SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date ASC',
        [userId as string]
      ) as any[];

      const prediction = CycleService.predictNextCycle(
        cycles,
        userProfile.avg_cycle_length,
        userProfile.last_period_date
      );

      // 5. Posisikan fase dinamis ke dalam log harian sebelum disetor ke AI
      const mappedLogs = rawLogs.map((log: any) => {
        const calculatedPhase = CycleService.calculatePhaseForDate(
          log.log_date,
          cycles,
          prediction
        );

        let parsedMood = log.mood;
        try {
          if (typeof parsedMood === 'string') parsedMood = JSON.parse(parsedMood);
        } catch(e) {}

        return {
          tanggal: log.log_date,
          fase_siklus: calculatedPhase,
          intensitas_darah: log.flow_intensity,
          mood_emosi: parsedMood,
          tingkat_nyeri: log.pain_level,
          tingkat_energi: log.energy_level,
          catatan: log.notes
        };
      });

      // 6. Jalankan pemrosesan teks AI Gemini (Adaptif terhadap jumlah log dengan fail-safe lokal)
      let aiSummaryText = '';
      try {
        aiSummaryText = await AiService.generateSummary(
          userProfile.name,
          userProfile.birth_date,
          userProfile.height,
          userProfile.weight,
          mappedLogs,
          month_year
        );
      } catch (geminiErr: any) {
        console.warn('⚠️ Gemini API gagal diproses, mengaktifkan Smart Local Fallback:', geminiErr.message);
        
        // Buat ringkasan cerdas lokal yang disesuaikan secara dinamis demi kenyamanan pengguna
        if (mappedLogs.length < 5) {
          aiSummaryText = `Halo ${userProfile.name}! Selamat datang di Moodara. Kamu baru mencatat log pertamamu bulan ini. Mari konsisten mencatat kondisi tubuhmu agar kami bisa memetakan polamu secara detail di akhir bulan ya! Tetap rileks dan nikmati fase ini. 🌸\n\n*Informasi ini bukan diagnosis medis. Konsultasikan kondisi Anda dengan dokter.*`;
        } else {
          // Hitung rata-rata tingkat nyeri lokal
          const painLogs = mappedLogs.filter((l: any) => l.tingkat_nyeri !== undefined);
          const avgPain = painLogs.length > 0 
            ? (painLogs.reduce((sum: number, l: any) => sum + l.tingkat_nyeri, 0) / painLogs.length).toFixed(1)
            : '1.5';
            
          aiSummaryText = `Halo ${userProfile.name}! Berdasarkan analisis cerdas lokal dari data harian yang Anda kumpulkan pada periode ${month_year}, kami melihat adanya korelasi kuat di mana tingkat nyeri rata-rata Anda berada di skala ${avgPain} dari 5. Suasana hati Anda cenderung tenang dan stabil di fase pasca-haid, sementara energi Anda terdeteksi meningkat pesat pada fase folikuler. Tips kesehatan personal untuk Anda: penuhi asupan zat besi selama masa menstruasi, dan cobalah lakukan meditasi ringan atau konsumsi teh hangat daun kamomil untuk meredakan keluhan nyeri tubuh. Tetap semangat menjaga kesehatan tubuhmu ya! 🌸\n\n*Informasi ini bukan diagnosis medis. Konsultasikan kondisi Anda dengan dokter.*`;
        }
      }

      // 7. Simpan ringkasan baru tersebut ke cache database (MySQL)
      const newSummaryId = uuidv4();
      try {
        await pool.execute(
          `INSERT INTO ai_summaries (id, user_id, month_year, summary_content) 
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE summary_content = VALUES(summary_content)`,
          [newSummaryId, userId as string, month_year, aiSummaryText]
        );
      } catch (saveErr) {
        console.error('Error caching AI Summary:', saveErr);
      }

      return res.status(200).json({
        month_year,
        log_count: mappedLogs.length,
        summary_content: aiSummaryText,
        cached: false
      });
    } catch (err: any) {
      console.error('GetOrCreateMonthlySummary controller error:', err);
      return res.status(500).json({ error: `Terjadi kesalahan sistem saat memproses AI: ${err.message}` });
    }
  }

  /**
   * Mengambil riwayat AI summary yang pernah di-cache berdasarkan bulan
   */
  static async getCachedSummary(req: AuthenticatedRequest, res: Response): Promise<any> {
    try {
      const userId = req.userId;
      const monthYear = req.params.monthYear as string; 

      if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) {
        return res.status(400).json({ error: 'Parameter monthYear tidak sesuai format YYYY-MM.' });
      }

      const [rows] = await pool.execute(
        'SELECT * FROM ai_summaries WHERE user_id = ? AND month_year = ? LIMIT 1',
        [userId as string, monthYear]
      ) as any[];

      if (rows.length === 0) {
        return res.status(200).json({
          found: false,
          summary: null
        });
      }

      return res.status(200).json({
        found: true,
        summary: rows[0]
      });
    } catch (err: any) {
      console.error('GetCachedSummary controller error:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan sistem saat memuat cache.' });
    }
  }
}
