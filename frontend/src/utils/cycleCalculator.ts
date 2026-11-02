import {
  addDays,
  subDays,
  differenceInDays,
  formatDate,
  classifyPhase,
  weightedAverageCycleLength,
} from './cycle-core';
import type { Phase } from './cycle-core';

export interface Cycle {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string | null;
  cycle_length: number | null;
  period_duration: number | null;
  notes?: string | null;
}

export interface CyclePrediction {
  next_period_date: string;
  ovulation_date: string;
  ovulation_window: string[];
  current_cycle_day: number; // non-negatif; bisa > panjang rata-rata saat telat
  days_until_period: number;
  is_late: boolean; // true saat today melewati next_period_date (Req 5.8)
  is_estimate: boolean; // true saat 0 siklus selesai -> default 28 (Req 5.5)
}

// Re-ekspor date helpers dari modul inti agar pemanggil lama tetap kompatibel.
export { addDays, subDays, differenceInDays, formatDate };

export class CycleCalculator {
  /**
   * Prediksi siklus berikutnya menggunakan Weighted Average (maks 6 siklus selesai).
   *
   * Memakai `weightedAverageCycleLength` dari modul inti bersama (Req 5.4). Bila
   * tidak ada siklus selesai, panjang default dipakai dan `is_estimate = true`
   * (Req 5.5). `current_cycle_day` dihitung non-negatif tanpa clamp ke 1, dan
   * `is_late` ditandai saat today melewati prediksi haid berikutnya (Req 5.8).
   *
   * Mencerminkan PERSIS `CycleService.predictNextCycle` di backend agar paritas
   * FE/BE terjaga (Req 5.6).
   */
  static predictNextCycle(
    cycles: Cycle[],
    defaultLength: number = 28,
    lastPeriodDate: string
  ): CyclePrediction {
    const today = new Date();
    const todayStr = formatDate(today);

    // Panjang siklus rata-rata (weighted) + jumlah siklus selesai yang dipakai.
    const { length: cycleLength, usedCount } = weightedAverageCycleLength(
      cycles,
      defaultLength
    );
    const isEstimate = usedCount === 0;

    // Tentukan hari pertama haid terakhir (last start date).
    let lastStartStr = lastPeriodDate;
    const sortedAllCycles = [...cycles].sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

    if (sortedAllCycles.length > 0) {
      lastStartStr = sortedAllCycles[sortedAllCycles.length - 1].start_date;
    }

    const lastStart = new Date(lastStartStr);

    // Prediksi haid berikutnya.
    const nextPeriod = addDays(lastStart, cycleLength);
    const nextPeriodStr = formatDate(nextPeriod);

    // Estimasi ovulasi (haid berikutnya - 14 hari).
    const ovulation = subDays(nextPeriod, 14);
    const ovulationStr = formatDate(ovulation);

    // Rentang ovulasi (ovulasi ±2 hari).
    const ovulationWindow: string[] = [];
    for (let i = -2; i <= 2; i++) {
      ovulationWindow.push(formatDate(addDays(ovulation, i)));
    }

    // Hari siklus saat ini: non-negatif, tanpa clamp ke 1 (Req 5.8).
    // differenceInDays(today, lastStart) + 1 >= 1 untuk today pada/setelah lastStart.
    const rawCycleDay = differenceInDays(todayStr, lastStartStr) + 1;
    const currentCycleDay = rawCycleDay > 0 ? rawCycleDay : 0;

    // Jumlah hari menuju haid berikutnya.
    const daysUntilPeriod = differenceInDays(nextPeriodStr, todayStr);

    // Telat: today melewati prediksi haid berikutnya.
    const isLate = differenceInDays(todayStr, nextPeriodStr) > 0;

    return {
      next_period_date: nextPeriodStr,
      ovulation_date: ovulationStr,
      ovulation_window: ovulationWindow,
      current_cycle_day: currentCycleDay,
      days_until_period: daysUntilPeriod,
      is_late: isLate,
      is_estimate: isEstimate,
    };
  }

  /**
   * Menghitung fase secara dinamis untuk suatu tanggal tertentu.
   *
   * Mendelegasikan ke `classifyPhase` dari modul inti bersama yang memakai ovulasi
   * relatif terhadap siklus tempat tanggal berada (Req 5.2) dengan luteal otomatis
   * 14 hari (Req 5.3). Mencerminkan PERSIS `CycleService.calculatePhaseForDate`
   * di backend (Req 5.6).
   */
  static calculatePhaseForDate(
    targetDateStr: string,
    cycles: Cycle[],
    prediction: CyclePrediction,
    avgPeriodDuration: number = 5
  ): Phase {
    return classifyPhase(targetDateStr, cycles, prediction, avgPeriodDuration);
  }
}
