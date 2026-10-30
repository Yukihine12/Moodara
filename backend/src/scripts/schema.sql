-- ===================================================
-- Skrip Inisialisasi Database PostgreSQL Moodara
-- ===================================================
-- Sumber kebenaran tunggal (single source of truth) untuk skema database.
-- Selaras dengan init-db.ts. Menyertakan CHECK constraint & UNIQUE constraint
-- agar data tidak valid tidak bisa masuk ke database.

-- 1. Tabel Autentikasi Pengguna
CREATE TABLE IF NOT EXISTS auth_users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Profil Medis Pengguna
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  birth_date DATE,
  height DECIMAL(5,2),
  weight DECIMAL(5,2),
  last_period_date DATE NOT NULL,
  avg_cycle_length INT DEFAULT 28 CHECK (avg_cycle_length BETWEEN 15 AND 90),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Riwayat Siklus Menstruasi
CREATE TABLE IF NOT EXISTS cycles (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  cycle_length INT CHECK (cycle_length IS NULL OR cycle_length BETWEEN 15 AND 90),
  period_duration INT CHECK (period_duration IS NULL OR period_duration BETWEEN 1 AND 20),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  -- Cegah duplikasi tanggal mulai haid yang sama untuk satu user
  CONSTRAINT unique_user_start_date UNIQUE (user_id, start_date),
  -- Pastikan tanggal selesai selalu >= tanggal mulai
  CONSTRAINT check_cycle_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- 4. Tabel Log Harian Gejala & Mood
CREATE TABLE IF NOT EXISTS daily_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  flow_intensity VARCHAR(50) DEFAULT 'none'
    CHECK (flow_intensity IN ('none', 'spotting', 'light', 'medium', 'heavy')),
  mood JSONB DEFAULT '[]'::jsonb,
  pain_level INT CHECK (pain_level IS NULL OR pain_level BETWEEN 1 AND 5),
  energy_level INT CHECK (energy_level IS NULL OR energy_level BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_log_date UNIQUE (user_id, log_date)
);

-- 5. Index untuk mempercepat query yang sering dipakai
CREATE INDEX IF NOT EXISTS idx_cycles_user_id ON cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_cycles_start_date ON cycles(start_date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_id ON daily_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(log_date);
