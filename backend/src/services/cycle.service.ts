import { Cycle, CyclePrediction } from '../types/index.js';

// Date Helpers
export const addDays = (date: Date | string, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const subDays = (date: Date | string, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
};

export const differenceInDays = (d1: Date | string, d2: Date | string): number => {
  const date1 = new Date(new Date(d1).toISOString().split('T')[0]);
  const date2 = new Date(new Date(d2).toISOString().split('T')[0]);
  const diffTime = date1.getTime() - date2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export class CycleService {
  /**
   * Prediksi siklus berikutnya menggunakan Weighted Average (maks 6 siklus terakhir)
   */
  static predictNextCycle(
    cycles: Cycle[],
    defaultLength: number = 28,
    lastPeriodDate: string
  ): CyclePrediction {
    const today = new Date();
    const todayStr = formatDate(today);

    // Filter siklus yang memiliki cycle_length (siklus yang sudah ditutup)
    const validCycles = cycles
      .filter((c) => c.cycle_length !== null)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

    let cycleLength = defaultLength;

    if (validCycles.length > 0) {
      // Ambil maksimal 6 siklus terakhir
      const recent = validCycles.slice(-6);
      
      // Hitung weighted average (siklus terbaru mendapat bobot lebih tinggi)
      let weightedSum = 0;
      let totalWeight = 0;
      
      recent.forEach((cycle, index) => {
        const weight = index + 1; // [1, 2, 3, 4, 5, 6]
        weightedSum += (cycle.cycle_length || defaultLength) * weight;
        totalWeight += weight;
      });

      cycleLength = Math.round(weightedSum / totalWeight);
    }

    // Tentukan hari pertama haid terakhir (last start date)
    let lastStartStr = lastPeriodDate;
    const sortedAllCycles = [...cycles].sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

    if (sortedAllCycles.length > 0) {
      lastStartStr = sortedAllCycles[sortedAllCycles.length - 1].start_date;
    }

    const lastStart = new Date(lastStartStr);

    // Hitung prediksi haid berikutnya
    const nextPeriod = addDays(lastStart, cycleLength);
    const nextPeriodStr = formatDate(nextPeriod);

    // Hitung estimasi ovulasi (Haid berikutnya - 14 hari)
    const ovulation = subDays(nextPeriod, 14);
    const ovulationStr = formatDate(ovulation);

    // Rentang ovulasi (ovulasi +- 2 hari)
    const ovulationWindow: string[] = [];
    for (let i = -2; i <= 2; i++) {
      ovulationWindow.push(formatDate(addDays(ovulation, i)));
    }

    // Hari siklus saat ini
    const currentCycleDay = differenceInDays(todayStr, lastStartStr) + 1;

    // Jumlah hari menuju haid berikutnya
    const daysUntilPeriod = differenceInDays(nextPeriodStr, todayStr);

    return {
      next_period_date: nextPeriodStr,
      ovulation_date: ovulationStr,
      ovulation_window: ovulationWindow,
      current_cycle_day: currentCycleDay > 0 ? currentCycleDay : 1,
      days_until_period: daysUntilPeriod
    };
  }

  /**
   * Menghitung fase secara dinamis untuk suatu tanggal tertentu
   */
  static calculatePhaseForDate(
    targetDateStr: string,
    cycles: Cycle[],
    prediction: CyclePrediction,
    avgPeriodDuration: number = 5
  ): 'menstruation' | 'follicular' | 'ovulation' | 'luteal' {
    const targetDate = new Date(targetDateStr);

    // 1. Cek apakah masuk fase Menstruasi (berdasarkan data riwayat atau prediksi)
    // Cari apakah targetDate masuk di dalam rentang menstruasi riwayat mana pun
    for (const cycle of cycles) {
      const start = new Date(cycle.start_date);
      // Jika end_date null (sedang haid) atau belum selesai, kita asumsikan selesai haid = start + avgPeriodDuration - 1
      const end = cycle.end_date 
        ? new Date(cycle.end_date) 
        : addDays(start, avgPeriodDuration - 1);

      if (targetDate >= start && targetDate <= end) {
        return 'menstruation';
      }
    }

    // Jika targetDate berada di prediksi haid berikutnya
    const predPeriodStart = new Date(prediction.next_period_date);
    const predPeriodEnd = addDays(predPeriodStart, avgPeriodDuration - 1);
    if (targetDate >= predPeriodStart && targetDate <= predPeriodEnd) {
      return 'menstruation';
    }

    // 2. Cek apakah masuk fase Ovulasi (Masa Subur)
    if (prediction.ovulation_window.includes(targetDateStr)) {
      return 'ovulation';
    }

    // 3. Tentukan apakah Folikuler atau Luteal
    // Cari siklus paling dekat sebelum targetDate
    const pastCycles = cycles
      .filter((c) => new Date(c.start_date) <= targetDate)
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

    let referenceStartDateStr = '';
    if (pastCycles.length > 0) {
      referenceStartDateStr = pastCycles[0].start_date;
    } else {
      // Fallback ke prediksi haid paling awal atau default last_period_date
      return 'follicular'; // default
    }

    const referenceStartDate = new Date(referenceStartDateStr);
    const dayOfCycle = differenceInDays(targetDateStr, referenceStartDateStr) + 1;

    // Cari tahu tanggal ovulasi untuk siklus referensi ini
    // Kita asumsikan masa ovulasi untuk siklus masa lalu berada pada 14 hari SEBELUM dimulainya siklus berikutnya
    // Jika tidak ada siklus berikutnya, kita gunakan estimasi prediksi saat ini
    const ovulationDayInCycle = prediction.current_cycle_day - differenceInDays(prediction.ovulation_date, targetDateStr);
    
    // Secara umum medis:
    // - Menstruasi: Hari 1 - 5/7
    // - Folikuler: Hari setelah haid selesai (Hari 6/8) hingga sebelum Ovulasi (Hari 11)
    // - Ovulasi: Hari 12 - 16 (tengah siklus)
    // - Luteal: Hari 17 hingga hari terakhir sebelum haid berikutnya
    
    const targetOvulationDate = new Date(prediction.ovulation_date);
    if (targetDate < targetOvulationDate) {
      return 'follicular';
    } else {
      return 'luteal';
    }
  }
}
