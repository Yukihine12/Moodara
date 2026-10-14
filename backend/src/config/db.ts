import pg from 'pg';
import { env } from './env.js';

// Parse DATE (OID 1082) as YYYY-MM-DD string to avoid timezone shifts
pg.types.setTypeParser(1082, (val: string) => val);

const { Pool } = pg;

// Create a connection pool to VPS PostgreSQL
const pool = new Pool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  port: parseInt(env.DB_PORT, 10),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

export default pool;
