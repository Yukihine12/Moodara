import pool from '../config/db.js';

async function initDB() {
  console.log('⏳ Connecting to PostgreSQL to initialize tables...');
  try {
    const client = await pool.connect();

    console.log('✅ Connected! Creating PostgreSQL tables if not exist...');

    console.log('✅ Creating auth_users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        birth_date DATE,
        height DECIMAL(5,2),
        weight DECIMAL(5,2),
        last_period_date DATE NOT NULL,
        avg_cycle_length INT DEFAULT 28,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Creating cycles table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cycles (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE,
        cycle_length INT,
        period_duration INT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Creating daily_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        log_date DATE NOT NULL,
        phase VARCHAR(50) DEFAULT 'follicular',
        flow_intensity VARCHAR(50) DEFAULT 'none',
        mood JSONB,
        pain_level INT NULL,
        energy_level INT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_log_date UNIQUE (user_id, log_date)
      )
    `);

    client.release();
    console.log('🎉 All PostgreSQL tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing PostgreSQL database:', error);
    process.exit(1);
  }
}

initDB();
