// =========================================================================
// Tipe data bersama (shared types) untuk seluruh aplikasi frontend Moodara.
// Dipisah dari App.tsx agar tiap komponen bisa meng-import tipe yang sama
// dan tidak ada duplikasi definisi `any` yang tersebar.
// =========================================================================

export type FlowIntensity = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';

export type CyclePhase = 'menstruation' | 'follicular' | 'ovulation' | 'luteal';

export interface Profile {
  name: string;
  birth_date: string;
  height: number | null;
  weight: number | null;
  last_period_date: string;
  avg_cycle_length: number;
}

export interface Cycle {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string | null;
  cycle_length: number | null;
  period_duration: number | null;
}

export interface DailyLog {
  log_date: string;
  flow_intensity: FlowIntensity;
  mood: string[];
  pain_level: number | null;
  energy_level: number | null;
  notes?: string;
  calculated_phase?: CyclePhase;
}

export interface CyclePrediction {
  next_period_date: string;
  ovulation_date: string;
  ovulation_window: string[];
  current_cycle_day: number;
  days_until_period: number;
}
