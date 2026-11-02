/**
 * Konstanta rentang kanonik & validator murni bersama.
 *
 * Modul ini adalah satu sumber kebenaran untuk rentang nilai tinggi, berat,
 * panjang siklus, durasi haid, dan usia. Seluruh fungsi di sini MURNI (tanpa
 * I/O) sehingga dapat diuji tanpa database dan dicerminkan persis ke frontend.
 *
 * Setiap validator mengembalikan daftar {@link FieldError}; array kosong berarti
 * nilai valid. Pesan selalu menyebut nama field dan rentang yang diizinkan.
 */

export const RANGES = {
  height: { min: 50, max: 250, unit: 'cm' },
  weight: { min: 20, max: 350, unit: 'kg', maxDecimals: 2 },
  cycleLength: { min: 15, max: 90, default: 28 },
  periodDuration: { min: 1, max: 20, default: 7 },
  age: { min: 8, max: 60 },
} as const;

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Mengubah nilai `unknown` menjadi number bila memungkinkan.
 * Menerima number berhingga atau string numerik non-kosong.
 * Mengembalikan `null` untuk nilai non-numerik (termasuk kosong, null, NaN, Infinity).
 */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    // Number('') === 0, maka kita sudah menyaring string kosong di atas.
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Menghitung jumlah angka desimal (digit setelah titik) dari sebuah angka.
 * Menggunakan representasi string agar galat pembulatan floating point tidak
 * membuat nilai seperti 55.1 terbaca sebagai memiliki banyak desimal.
 */
function decimalPlaces(value: number): number {
  if (Number.isInteger(value)) return 0;
  const str = Math.abs(value).toString();
  if (str.includes('e') || str.includes('E')) {
    // Notasi eksponensial (misal 1e-7): perlakukan sebagai banyak desimal.
    const match = str.match(/e-(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
  }
  const dotIndex = str.indexOf('.');
  return dotIndex === -1 ? 0 : str.length - dotIndex - 1;
}

/**
 * Validasi tinggi badan: harus angka positif dalam rentang 50-250 cm.
 */
export function validateHeight(value: unknown): FieldError[] {
  const field = 'height';
  const n = toNumber(value);

  if (n === null) {
    return [{ field, message: 'Tinggi badan harus berupa angka.' }];
  }
  if (n <= 0) {
    return [{ field, message: 'Tinggi badan harus berupa angka positif.' }];
  }
  if (n < RANGES.height.min || n > RANGES.height.max) {
    return [
      {
        field,
        message: `Tinggi badan harus antara ${RANGES.height.min} dan ${RANGES.height.max} ${RANGES.height.unit}.`,
      },
    ];
  }
  return [];
}

/**
 * Validasi berat badan: harus angka positif dalam rentang 20-350 kg dengan
 * maksimum 2 angka desimal.
 */
export function validateWeight(value: unknown): FieldError[] {
  const field = 'weight';
  const n = toNumber(value);

  if (n === null) {
    return [{ field, message: 'Berat badan harus berupa angka.' }];
  }
  if (n <= 0) {
    return [{ field, message: 'Berat badan harus berupa angka positif.' }];
  }
  if (decimalPlaces(n) > RANGES.weight.maxDecimals) {
    return [
      {
        field,
        message: `Berat badan maksimum ${RANGES.weight.maxDecimals} angka di belakang koma.`,
      },
    ];
  }
  if (n < RANGES.weight.min || n > RANGES.weight.max) {
    return [
      {
        field,
        message: `Berat badan harus antara ${RANGES.weight.min} dan ${RANGES.weight.max} ${RANGES.weight.unit}.`,
      },
    ];
  }
  return [];
}

/**
 * Menghitung usia penuh (tahun) dari tanggal lahir, memperhitungkan bulan dan
 * tanggal (bukan sekadar selisih tahun). `today` dapat diinjeksi untuk pengujian.
 *
 * Mengembalikan `NaN` bila `birthDate` tidak dapat diurai sebagai tanggal sah.
 */
export function ageFromBirthDate(birthDate: string, today: Date = new Date()): number {
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) {
    return NaN;
  }

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  // Belum sampai bulan/tanggal ulang tahun pada tahun ini -> kurangi 1.
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Validasi tanggal lahir: tidak boleh di masa depan, usia harus 8-60 tahun
 * inklusif, dan string harus dapat diurai sebagai tanggal yang sah.
 */
export function validateBirthDate(value: unknown, today: Date = new Date()): FieldError[] {
  const field = 'birth_date';

  if (typeof value !== 'string' || value.trim() === '') {
    return [{ field, message: 'Tanggal lahir wajib diisi dengan format tanggal yang sah.' }];
  }

  const birth = new Date(value);
  if (isNaN(birth.getTime())) {
    return [{ field, message: 'Tanggal lahir tidak dapat diurai sebagai tanggal yang sah.' }];
  }

  // Bandingkan pada level tanggal (abaikan jam) agar tanggal hari ini tidak
  // dianggap masa depan karena komponen waktu.
  const birthDay = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (birthDay.getTime() > todayDay.getTime()) {
    return [{ field, message: 'Tanggal lahir tidak boleh berada di masa depan.' }];
  }

  const age = ageFromBirthDate(value, today);

  if (age < RANGES.age.min) {
    return [{ field, message: `Usia minimum yang diizinkan adalah ${RANGES.age.min} tahun.` }];
  }
  if (age > RANGES.age.max) {
    return [{ field, message: `Usia maksimum yang diizinkan adalah ${RANGES.age.max} tahun.` }];
  }
  return [];
}

/**
 * Validasi panjang siklus rata-rata: bilangan dalam rentang 15-90 hari.
 */
export function validateCycleLength(value: unknown): FieldError[] {
  const field = 'avg_cycle_length';
  const n = toNumber(value);

  if (n === null) {
    return [{ field, message: 'Panjang siklus harus berupa angka.' }];
  }
  if (!Number.isInteger(n)) {
    return [{ field, message: 'Panjang siklus harus berupa bilangan bulat (hari).' }];
  }
  if (n < RANGES.cycleLength.min || n > RANGES.cycleLength.max) {
    return [
      {
        field,
        message: `Panjang siklus harus antara ${RANGES.cycleLength.min} dan ${RANGES.cycleLength.max} hari.`,
      },
    ];
  }
  return [];
}

/**
 * Validasi durasi haid rata-rata: bilangan dalam rentang 1-20 hari.
 */
export function validatePeriodDuration(value: unknown): FieldError[] {
  const field = 'avg_period_duration';
  const n = toNumber(value);

  if (n === null) {
    return [{ field, message: 'Durasi haid harus berupa angka.' }];
  }
  if (!Number.isInteger(n)) {
    return [{ field, message: 'Durasi haid harus berupa bilangan bulat (hari).' }];
  }
  if (n < RANGES.periodDuration.min || n > RANGES.periodDuration.max) {
    return [
      {
        field,
        message: `Durasi haid harus antara ${RANGES.periodDuration.min} dan ${RANGES.periodDuration.max} hari.`,
      },
    ];
  }
  return [];
}

/**
 * Validasi komposit payload onboarding. Mengumpulkan error dari seluruh field
 * yang relevan. `avg_cycle_length` dan `avg_period_duration` opsional: bila
 * tidak disertakan (undefined/null), field tersebut dilewati karena Backend akan
 * memakai nilai default; bila disertakan, nilainya divalidasi terhadap rentang.
 */
export function validateOnboardingPayload(body: unknown, today: Date = new Date()): FieldError[] {
  const errors: FieldError[] = [];
  const payload = (body ?? {}) as Record<string, unknown>;

  errors.push(...validateBirthDate(payload.birth_date, today));
  errors.push(...validateHeight(payload.height));
  errors.push(...validateWeight(payload.weight));

  if (payload.avg_cycle_length !== undefined && payload.avg_cycle_length !== null) {
    errors.push(...validateCycleLength(payload.avg_cycle_length));
  }
  if (payload.avg_period_duration !== undefined && payload.avg_period_duration !== null) {
    errors.push(...validatePeriodDuration(payload.avg_period_duration));
  }

  return errors;
}

/**
 * Validasi komposit untuk pembaruan berat badan (Halaman Akun).
 */
export function validateWeightUpdate(body: unknown): FieldError[] {
  const payload = (body ?? {}) as Record<string, unknown>;
  return validateWeight(payload.weight);
}
