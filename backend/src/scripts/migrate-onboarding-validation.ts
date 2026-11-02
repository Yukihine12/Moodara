import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Migrasi idempoten untuk fitur "onboarding-validation-and-cycle-accuracy".
 *
 * Tujuan:
 *  - Menambah kolom `avg_period_duration` pada `users` (nullable dulu).
 *  - Backfill nilai `height`/`weight`/`avg_period_duration` yang NULL ke default
 *    SEBELUM menerapkan constraint (Req 2.7) agar baris lama tidak menggagalkan migrasi.
 *  - Menjepit (clamp) nilai di luar rentang dengan LEAST/GREATEST agar CHECK tidak gagal.
 *  - Menerapkan NOT NULL + CHECK bernama (idempoten via DROP CONSTRAINT IF EXISTS).
 *  - Membuat tabel `body_measurements` + index (CREATE ... IF NOT EXISTS).
 *  - Seed titik awal pengukuran (tinggi + berat) dari baris `users` yang ada,
 *    hanya untuk user yang belum punya entri (titik awal grafik, Req 6.7).
 *
 * Mengikuti pola `init-db.ts` dan dijalankan via `tsx`.
 * Aman dijalankan berkali-kali (idempoten).
 *
 * Requirements: 1.6, 2.6, 2.7, 6.7
 */
async function migrate() {
  console.log('⏳ Connecting to PostgreSQL to run onboarding-validation migration...');
  const client = await pool.connect();

  try {
    console.log('✅ Connected! Starting migration...');
    await client.query('BEGIN');

    // ---------------------------------------------------------------
    // 1. Tambah kolom baru (nullable dulu)
    // ---------------------------------------------------------------
    console.log('✅ [1/5] Menambah kolom avg_period_duration (nullable dulu)...');
    await client.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS avg_period_duration INT DEFAULT 7`
    );

    // ---------------------------------------------------------------
    // 2. Backfill NULL lama ke default sebelum NOT NULL (Req 2.7),
    //    lalu jepit nilai di luar rentang agar CHECK tidak gagal.
    // ---------------------------------------------------------------
    console.log('✅ [2/5] Backfill NULL ke default lalu clamp nilai di luar rentang...');
    await client.query(`UPDATE users SET height = 160 WHERE height IS NULL`);
    await client.query(`UPDATE users SET weight = 55  WHERE weight IS NULL`);
    await client.query(`UPDATE users SET avg_period_duration = 7 WHERE avg_period_duration IS NULL`);
    // Jepit nilai di luar rentang agar CHECK tidak gagal saat diterapkan
    await client.query(`UPDATE users SET height = LEAST(GREATEST(height, 50), 250)`);
    await client.query(`UPDATE users SET weight = LEAST(GREATEST(weight, 20), 350)`);
    await client.query(
      `UPDATE users SET avg_period_duration = LEAST(GREATEST(avg_period_duration, 1), 20)`
    );

    // ---------------------------------------------------------------
    // 3. Terapkan NOT NULL + CHECK bernama.
    //    DROP CONSTRAINT IF EXISTS dulu agar idempoten (bisa dijalankan ulang).
    // ---------------------------------------------------------------
    console.log('✅ [3/5] Menerapkan NOT NULL + CHECK bernama (idempoten)...');
    await client.query(`ALTER TABLE users ALTER COLUMN height SET NOT NULL`);
    await client.query(`ALTER TABLE users ALTER COLUMN weight SET NOT NULL`);

    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_height`);
    await client.query(
      `ALTER TABLE users ADD CONSTRAINT chk_users_height CHECK (height BETWEEN 50 AND 250)`
    );

    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_weight`);
    await client.query(
      `ALTER TABLE users ADD CONSTRAINT chk_users_weight CHECK (weight BETWEEN 20 AND 350)`
    );

    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_period`);
    await client.query(
      `ALTER TABLE users ADD CONSTRAINT chk_users_period CHECK (avg_period_duration BETWEEN 1 AND 20)`
    );

    // ---------------------------------------------------------------
    // 4. Buat tabel body_measurements + index (sesuai schema.sql)
    // ---------------------------------------------------------------
    console.log('✅ [4/5] Membuat tabel body_measurements + index...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS body_measurements (
        id          VARCHAR(36) PRIMARY KEY,
        user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type        VARCHAR(10) NOT NULL CHECK (type IN ('weight', 'height')),
        value       DECIMAL(6,2) NOT NULL
                    CHECK ((type = 'weight' AND value BETWEEN 20 AND 350)
                       OR  (type = 'height' AND value BETWEEN 50 AND 250)),
        recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_measurements_user_type_date
        ON body_measurements(user_id, type, recorded_at)
    `);

    // ---------------------------------------------------------------
    // 5. Seed titik awal pengukuran (tinggi + berat) dari users yang ada.
    //    Hanya untuk user yang belum punya entri bertipe sama (idempoten).
    //    Tanggal pencatatan = last_period_date bila ada, selain itu CURRENT_DATE.
    // ---------------------------------------------------------------
    console.log('✅ [5/5] Seeding titik awal body_measurements dari users yang ada...');

    // Ambil user yang perlu di-seed per tipe (belum punya entri tipe tsb).
    const { rows: usersToSeed } = await client.query<{
      id: string;
      height: string | null;
      weight: string | null;
      last_period_date: string | null;
    }>(`
      SELECT id, height, weight, last_period_date
      FROM users
    `);

    let seededHeight = 0;
    let seededWeight = 0;

    for (const u of usersToSeed) {
      const recordedAt = u.last_period_date ?? null; // null -> pakai DEFAULT CURRENT_DATE

      // Seed tinggi (hanya jika belum ada entri tipe 'height' untuk user ini)
      if (u.height != null) {
        const res = await client.query(
          `INSERT INTO body_measurements (id, user_id, type, value, recorded_at)
           SELECT $1, $2, 'height', $3, COALESCE($4::date, CURRENT_DATE)
           WHERE NOT EXISTS (
             SELECT 1 FROM body_measurements
             WHERE user_id = $2 AND type = 'height'
           )`,
          [uuidv4(), u.id, u.height, recordedAt]
        );
        seededHeight += res.rowCount ?? 0;
      }

      // Seed berat (hanya jika belum ada entri tipe 'weight' untuk user ini)
      if (u.weight != null) {
        const res = await client.query(
          `INSERT INTO body_measurements (id, user_id, type, value, recorded_at)
           SELECT $1, $2, 'weight', $3, COALESCE($4::date, CURRENT_DATE)
           WHERE NOT EXISTS (
             SELECT 1 FROM body_measurements
             WHERE user_id = $2 AND type = 'weight'
           )`,
          [uuidv4(), u.id, u.weight, recordedAt]
        );
        seededWeight += res.rowCount ?? 0;
      }
    }

    console.log(
      `   → Seed selesai: ${seededHeight} titik tinggi, ${seededWeight} titik berat ditambahkan.`
    );

    await client.query('COMMIT');
    console.log('🎉 Migrasi onboarding-validation berhasil diterapkan!');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error menjalankan migrasi onboarding-validation:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
