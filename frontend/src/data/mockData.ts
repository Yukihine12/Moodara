import type { Profile, Cycle, DailyLog } from '../types/index.js';

// =========================================================================
// MOCK DATA — dipakai HANYA untuk "Mode Demo" (tanpa login) agar juri/dosen
// bisa mencoba aplikasi tanpa backend berjalan.
//
// Catatan: objek & array ini sengaja dibuat `let`/mutable karena fitur demo
// memodifikasinya in-place (lihat komponen di App.tsx). Dipisah ke modul
// sendiri supaya App.tsx tidak lagi memikul data dummy.
// =========================================================================

export const MOCK_PROFILE: Profile = {
  name: 'Rara',
  birth_date: '2003-08-15',
  height: 160,
  weight: 52,
  last_period_date: '2026-05-10',
  avg_cycle_length: 28
};

export const MOCK_CYCLES: Cycle[] = [
  { id: '1', user_id: 'mock', start_date: '2026-03-12', end_date: '2026-03-17', cycle_length: 29, period_duration: 6 },
  { id: '2', user_id: 'mock', start_date: '2026-04-10', end_date: '2026-04-15', cycle_length: 30, period_duration: 6 },
  { id: '3', user_id: 'mock', start_date: '2026-05-10', end_date: null, cycle_length: null, period_duration: null }
];

export const MOCK_LOGS: DailyLog[] = [
  { log_date: '2026-05-10', flow_intensity: 'heavy', mood: ['sad', 'anxious'], pain_level: 4, energy_level: 2, notes: 'Kram perut parah di hari pertama.' },
  { log_date: '2026-05-11', flow_intensity: 'medium', mood: ['sad'], pain_level: 3, energy_level: 3, notes: 'Masih kram sedikit.' },
  { log_date: '2026-05-12', flow_intensity: 'light', mood: ['calm'], pain_level: 2, energy_level: 4, notes: 'Nyeri mereda.' }
];
