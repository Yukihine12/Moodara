/**
 * Modul inti siklus murni (shared core).
 *
 * Modul ini adalah satu sumber kebenaran untuk logika perhitungan siklus yang
 * dipakai oleh backend (`cycle.service.ts`) dan dicerminkan persis ke frontend
 * (`frontend/src/utils/cycle-core.ts`). Seluruh fungsi di sini MURNI (tanpa I/O)
 * sehingga dapat diuji tanpa database dan menjamin paritas FE/BE (Req 5.6).
 *
 * Prinsip medis yang ditegakkan:
 * - Ovulasi per siklus = (tanggal mulai siklus berikutnya) - 14 hari (Req 5.1).
 * - Fase luteal selalu tepat 14 hari; variasi panjang siklus hanya terserap pada
 *   fase folikuler (Req 5.2, 5.3).
 * - Jendela ovulasi = ovulasi referensi ±2 hari.
 * - Panjang siklus rata-rata memakai weighted average dari maksimal enam siklus
 *   selesai terakhir dengan bobot naik ke siklus terbaru (Req 5.4).
 */

import { Cycle, CyclePrediction } from '../types/index.js';

/** Fase siklus menstruasi. */
export type Phase = 'menstruation' | 'follicular' | 'ovulation' | 'luteal';

// ---------------------------------------------------------------------------
// Date Helpers (identik dengan cycle.service.ts untuk menjaga paritas FE/BE)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Fungsi inti siklus
// ---------------------------------------------------------------------------

/**
 * Menghitung tanggal ovulasi untuk sebuah siklus.
 *
 * Ovulasi diikat ke awal siklus berikutnya dikurangi 14 hari, sehingga fase
 * luteal otomatis selalu tepat 14 hari (Req 5.1, 5.3).
 *
 * @param cycleStart Tanggal mulai siklus referensi (YYYY-MM-DD). Disertakan untuk
 *   kejelasan tanda tangan; perhitungan hanya bergantung pada `nextCycleStart`.
 * @param nextCycleStart Tanggal mulai siklus berikutnya (YYYY-MM-DD).
 * @returns Tanggal ovulasi dalam format YYYY-MM-DD.
 */
export function ovulationForCycle(cycleStart: string, nextCycleStart: string): string {
  // Ovulasi = mulai siklus berikutnya - 14 hari. `cycleStart` dipertahankan pada
  // tanda tangan agar selaras dengan desain dan keterbacaan pemanggil.
  void cycleStart;
  return formatDate(subDays(new Date(nextCycleStart), 14));
}

/**
 * Menghitung panjang siklus rata-rata memakai weighted average.
 *
 * Hanya siklus dengan `cycle_length` non-null (siklus selesai) yang dipakai,
 * maksimal enam siklus selesai terakhir, dengan bobot naik ke siklus terbaru.
 * Bila tidak ada siklus selesai, kembalikan `defaultLength` dengan `usedCount = 0`
 * (penanda estimasi, Req 5.5).
 *
 * @param cycles Daftar siklus (urutan apa pun; diurutkan internal berdasarkan start_date).
 * @param defaultLength Panjang default saat tidak ada siklus selesai (mis. 28).
 * @returns `{ length, usedCount }` panjang rata-rata dibulatkan dan jumlah siklus yang dipakai.
 */
export function weightedAverageCycleLength(
  cycles: Cycle[],
  defaultLength: number
): { length: number; usedCount: number } {
  const completed = cycles
    .filter((c) => c.cycle_length !== null && c.cycle_length !== undefined)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  if (completed.length === 0) {
    return { length: defaultLength, usedCount: 0 };
  }

  // Ambil maksimal 6 siklus selesai terakhir.
  const recent = completed.slice(-6);

  // Weighted average: siklus terbaru mendapat bobot lebih besar ([1, 2, 3, ...]).
  let weightedSum = 0;
  let totalWeight = 0;

  recent.forEach((cycle, index) => {
    const weight = index + 1;
    weightedSum += (cycle.cycle_length ?? defaultLength) * weight;
    totalWeight += weight;
  });

  return {
    length: Math.round(weightedSum / totalWeight),
    usedCount: recent.length,
  };
}

/**
 * Mengklasifikasikan fase siklus untuk sebuah tanggal target.
 *
 * Memakai ovulasi relatif terhadap siklus tempat tanggal berada, bukan ovulasi
 * siklus berjalan secara global (Req 5.2). Luteal otomatis 14 hari karena ovulasi
 * diikat ke start siklus berikutnya - 14 (Req 5.3). Jendela ovulasi = ±2 hari.
 *
 * Langkah:
 * 1. Jika target dalam rentang menstruasi riwayat/prediksi -> 'menstruation'.
 * 2. Tentukan siklus referensi (start_date terdekat <= target) dan siklus berikutnya.
 * 3. Ovulasi referensi = ovulationForCycle(ref.start, next.start); bila tidak ada
 *    siklus berikutnya, pakai prediction.ovulation_date.
 * 4. Dalam ovulasi referensi ±2 hari -> 'ovulation'.
 * 5. target < ovulasi referensi -> 'follicular'; selainnya -> 'luteal'.
 *
 * @param target Tanggal target (YYYY-MM-DD).
 * @param cycles Daftar siklus pengguna.
 * @param prediction Prediksi siklus berjalan (untuk fallback & prediksi haid berikutnya).
 * @param avgPeriodDuration Durasi haid rata-rata untuk mengestimasi akhir menstruasi.
 * @returns Fase: 'menstruation' | 'follicular' | 'ovulation' | 'luteal'.
 */
export function classifyPhase(
  target: string,
  cycles: Cycle[],
  prediction: CyclePrediction,
  avgPeriodDuration: number
): Phase {
  const targetDate = new Date(target);

  // 1. Fase menstruasi berdasarkan rentang riwayat.
  for (const cycle of cycles) {
    const start = new Date(cycle.start_date);
    // Jika end_date null (sedang/ belum ditutup), estimasi akhir = start + (durasi - 1).
    const end = cycle.end_date
      ? new Date(cycle.end_date)
      : addDays(start, avgPeriodDuration - 1);

    if (targetDate >= start && targetDate <= end) {
      return 'menstruation';
    }
  }

  // Fase menstruasi berdasarkan prediksi haid berikutnya.
  const predPeriodStart = new Date(prediction.next_period_date);
  const predPeriodEnd = addDays(predPeriodStart, avgPeriodDuration - 1);
  if (targetDate >= predPeriodStart && targetDate <= predPeriodEnd) {
    return 'menstruation';
  }

  // 2. Tentukan siklus referensi (start_date terdekat <= target) dan siklus berikutnya.
  const sorted = [...cycles].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  let reference: Cycle | null = null;
  let next: Cycle | null = null;

  for (let i = 0; i < sorted.length; i++) {
    if (new Date(sorted[i].start_date) <= targetDate) {
      reference = sorted[i];
      next = i + 1 < sorted.length ? sorted[i + 1] : null;
    } else {
      break;
    }
  }

  // Tidak ada siklus referensi (target sebelum semua siklus) -> default folikuler.
  if (!reference) {
    return 'follicular';
  }

  // 3. Ovulasi referensi: siklus berikutnya - 14, atau fallback ke prediksi.
  const ovulationStr = next
    ? ovulationForCycle(reference.start_date, next.start_date)
    : prediction.ovulation_date;
  const ovulationDate = new Date(ovulationStr);

  // 4. Jendela ovulasi = ovulasi referensi ±2 hari.
  const windowStart = subDays(ovulationDate, 2);
  const windowEnd = addDays(ovulationDate, 2);
  if (targetDate >= windowStart && targetDate <= windowEnd) {
    return 'ovulation';
  }

  // 5. Folikuler vs luteal relatif terhadap ovulasi siklus referensi.
  if (targetDate < ovulationDate) {
    return 'follicular';
  }
  return 'luteal';
}
