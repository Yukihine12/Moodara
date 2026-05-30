import pool from '../config/db.js';

async function initDB() {
  console.log('⏳ Connecting to GCP MySQL to initialize tables...');
  try {
    const connection = await pool.getConnection();

    console.log('✅ Connected! Creating database if not exists...');
    await connection.query('CREATE DATABASE IF NOT EXISTS moodara_db');
    await connection.query('USE moodara_db');

    console.log('✅ Creating auth_users table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Creating users table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        birth_date DATE,
        height DECIMAL(5,2),
        weight DECIMAL(5,2),
        last_period_date DATE NOT NULL,
        avg_cycle_length INT DEFAULT 28,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (id) REFERENCES auth_users(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Creating cycles table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS cycles (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        cycle_length INT,
        period_duration INT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Creating daily_logs table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS daily_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        log_date DATE NOT NULL,
        phase VARCHAR(50) DEFAULT 'follicular',
        flow_intensity VARCHAR(50) DEFAULT 'none',
        mood JSON,
        pain_level INT NULL,
        energy_level INT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE(user_id, log_date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Creating ai_summaries table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ai_summaries (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        month_year VARCHAR(7) NOT NULL,
        summary_content TEXT NOT NULL,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, month_year),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    connection.release();
    console.log('🎉 All tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

initDB();
