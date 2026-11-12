import { getPool, closeDatabase } from '../src/db.js';
import { baselineMigrations } from '../src/migration-runner.js';
import { migrationFiles, loadMigrationSql } from '../src/migrations.js';

if (process.env.CONFIRM_MIGRATION_BASELINE !== 'yes') {
  throw new Error('Abbruch: CONFIRM_MIGRATION_BASELINE=yes muss ausdrücklich gesetzt sein.');
}

try {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL fehlt.');
  const client = await pool.connect();
  try {
    await baselineMigrations(client, migrationFiles, loadMigrationSql);
  } finally {
    client.release();
  }
} finally {
  await closeDatabase();
}
