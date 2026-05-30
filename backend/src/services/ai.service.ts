import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';

export class AiService {
  /**
   * Memicu AI Gemini untuk merangkum data bulanan secara cerdas dan personal
   */
  static async generateSummary(
    name: string,
    birthDate: string,
    height: number | undefined,
    weight: number | undefined,
    logs: any[],
    monthYear: string
  ): Promise<string> {
    try {
      if (!env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY belum terkonfigurasi pada file env backend!');
      }

      // Hitung umur user secara kasar
      const age = birthDate 
        ? new Date().getFullYear() - new Date(birthDate).getFullYear() 
        : 23;
      const heightStr = height ? `${height} cm` : 'tidak diisi';
      const weightStr = weight ? `${weight} kg` : 'tidak diisi';
      const logCount = logs.length;

      // Inisialisasi model Google Gemini Legacy SDK (gemini-1.5-flash) menggunakan API v1 stabil
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }, { apiVersion: 'v1' });

      let prompt = '';

      if (logCount < 5) {
        // Skenario A: Log Masih Sedikit (1 - 4 Hari)
        prompt = `
          Anda adalah AI asisten kesehatan wanita personal dari Moodara yang hangat, peduli, dan berbahasa Indonesia.
          Nama Pengguna: ${name}
          Umur: ${age} tahun
          Tinggi Badan: ${heightStr}
          Berat Badan: ${weightStr}
          Pengguna baru mencatat log harian sebanyak ${logCount} hari pada bulan ini (${monthYear}).

          Data Log Mentah Pengguna:
          ${JSON.stringify(logs, null, 2)}

          Instruksi:
          Karena data log pengguna masih sangat sedikit (baru memulai mencatat atau jarang mencatat), buatlah sapaan selamat datang yang hangat. Berikan motivasi yang tulus, bersahabat, dan ramah agar mereka konsisten mencatat kondisi fisik, mental, dan emosi mereka di Moodara setiap hari. Berikan penjelasan singkat, suportif, dan edukatif mengenai pentingnya memahami fase dan pola siklus menstruasi tubuh bagi perempuan. Gunakan emoji yang hangat dan menenangkan. Maksimum 2 paragraf pendek.
          
          PENTING: Sertakan disclaimer medis berikut di bagian paling bawah dipisahkan dengan baris kosong baru:
          "*Informasi ini bukan diagnosis medis. Konsultasikan kondisi Anda dengan dokter.*"
        `;
      } else {
        // Skenario B: Log Cukup Banyak (5 Hari atau Lebih)
        prompt = `
          Anda adalah AI asisten kesehatan wanita personal dari Moodara yang cerdas, hangat, ramah, dan berbahasa Indonesia.
          Nama Pengguna: ${name}
          Umur: ${age} tahun
          Tinggi Badan: ${heightStr}
          Berat Badan: ${weightStr}
          Pengguna memiliki data log bulanan sebanyak ${logCount} hari pada periode ${monthYear} dengan rincian berikut:

          Data Log Mentah Harian Pengguna:
          ${JSON.stringify(logs, null, 2)}

          Instruksi:
          1. Analisis data harian pengguna di atas secara mendalam dan temukan pola atau korelasi menarik antara fase siklus (menstruasi, ovulasi, luteal, folikuler) dengan tingkat nyeri (pain_level), tingkat energi (energy_level), emosi/mood, serta catatan log (notes) harian mereka.
          2. Berikan penjelasan/wawasan kesehatan yang sangat personal, edukatif, ramah, dan menenangkan (tone hangat, tidak klinis, dan tidak menghakimi).
          3. Berikan tips self-care praktis (seperti nutrisi yang disarankan, teknik relaksasi, atau olahraga ringan) yang sangat relevan dengan keluhan/pola yang paling menonjol pada tubuh mereka.
          Maksimum 3 paragraf.
          
          PENTING: Sertakan disclaimer medis berikut di bagian paling bawah dipisahkan dengan baris kosong baru:
          "*Informasi ini bukan diagnosis medis. Konsultasikan kondisi Anda dengan dokter.*"
        `;
      }

      let responseText = '';
      try {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        responseText = result.response.text();
      } catch (geminiErr: any) {
        console.warn('⚠️ Gagal menggunakan model gemini-1.5-flash pada API v1. Mencoba model fallback gemini-pro...', geminiErr);
        try {
          const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-pro' });
          const result = await fallbackModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
          });
          responseText = result.response.text();
        } catch (fallbackErr: any) {
          console.error('⚠️ Kedua model Gemini (gemini-1.5-flash & gemini-pro) gagal diproses:', fallbackErr);
          throw fallbackErr;
        }
      }

      return responseText || 'Gagal menghasilkan kesimpulan AI dari Gemini.';
    } catch (error: any) {
      console.error('Error generating AI Summary from Gemini SDK:', error);
      throw new Error(`Gagal memproses AI Summary: ${error.message}`);
    }
  }
}
