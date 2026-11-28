import pg from "pg";

const { Pool } = pg;
let pool;

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

// Keep TLS policy outside the URL so pg cannot replace the SSL options.
export function databasePoolOptions(env = process.env) {
  const url = new URL(env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new Error("Invalid PostgreSQL connection URL");
  }
  // Only retain URL options explicitly supported by this application.
  for (const key of [...url.searchParams.keys()]) {
    if (key !== "application_name") url.searchParams.delete(key);
  }
  const mode = env.DATABASE_SSL;
  if (mode !== undefined && mode !== "" && mode !== "true" && mode !== "false") {
    throw new Error("Invalid DATABASE_SSL setting");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (mode === "false" && (!local || env.NODE_ENV === "production")) {
    throw new Error("Unencrypted PostgreSQL is allowed only for local non-production use");
  }
  const ssl = mode === "false" ? false : { rejectUnauthorized: true };
  if (ssl && env.DATABASE_SSL_CA) ssl.ca = env.DATABASE_SSL_CA;
  return {
    connectionString: url.toString(),
    max: Number(env.DB_POOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl
  };
}

export function getPool() {
  if (!databaseConfigured()) return null;
  if (!pool) {
    pool = new Pool(databasePoolOptions());
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
