import { getPool, closeDatabase } from "../src/db.js";
import { applyMigrations } from "../src/migration-runner.js";
import { migrationFiles, loadMigrationSql } from "../src/migrations.js";

try {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL fehlt.");
  const client = await pool.connect();
  try {
    await applyMigrations(client, migrationFiles, loadMigrationSql);
  } finally {
    client.release();
  }
} finally {
  await closeDatabase();
}
