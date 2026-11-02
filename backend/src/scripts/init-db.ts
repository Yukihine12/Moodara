import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from '../config/db.js';

// Resolve schema.sql relative to this script (ESM-safe path resolution)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCHEMA_PATH = join(__dirname, 'schema.sql');

async function initDB() {
  console.log('⏳ Connecting to PostgreSQL to initialize tables...');
  try {
    const client = await pool.connect();

    console.log('✅ Connected! Applying schema from schema.sql (single source of truth)...');

    // schema.sql is the single source of truth for the database schema.
    // Reading and executing it directly prevents drift between init and schema.
    const schemaSQL = readFileSync(SCHEMA_PATH, 'utf-8');

    console.log('✅ Creating tables & indexes if not exist...');
    await client.query(schemaSQL);

    client.release();
    console.log('🎉 All PostgreSQL tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing PostgreSQL database:', error);
    process.exit(1);
  }
}

initDB();
