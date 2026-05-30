export interface User {
  id: string;
  name: string;
  birth_date: string; // YYYY-MM-DD
  height?: number;
  weight?: number;
  last_period_date: string; // YYYY-MM-DD
  avg_cycle_length: number;
  created_at?: string;
  updated_at?: string;
}

export interface Cycle {
  id: string;
  user_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD
  cycle_length: number | null;
  period_duration: number | null;
  notes?: string | null;
  created_at?: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  log_date: string; // YYYY-MM-DD
  flow_intensity: 'none' | 'spotting' | 'light' | 'medium' | 'heavy' | null;
  mood: string[]; // e.g., ['happy', 'sad']
  pain_level: number | null; // 1 to 5
  energy_level: number | null; // 1 to 5
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AiSummary {
  id: string;
  user_id: string;
  month_year: string; // YYYY-MM
  summary_content: string;
  generated_at?: string;
}

export interface CyclePrediction {
  next_period_date: string;
  ovulation_date: string;
  ovulation_window: string[];
  current_cycle_day: number;
  days_until_period: number;
}
