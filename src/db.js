import pg from "pg";

const { Pool } = pg;
let pool;

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!databaseConfigured()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX || 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
    });
    pool.on("error", error => console.error("database_pool_error", error.message));
  }
  return pool;
}

export async function databaseCheck() {
  const activePool = getPool();
  if (!activePool) return { configured: false, connected: false };
  try {
    await activePool.query("select 1");
    return { configured: true, connected: true };
  } catch (error) {
    return { configured: true, connected: false, error: error.message };
  }
}

export async function closeDatabase() {
  if (pool) await pool.end();
  pool = undefined;
}

