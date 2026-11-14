import { getPool, closeDatabase } from '../src/db.js';
import { baselineMigrations } from '../src/migration-runner.js';
import { loadMigrationSql } from '../src/migrations.js';
import { legacyBaselineFiles } from '../src/legacy-baseline-files.js';
import { assertHistoricalBaselineShape } from '../src/legacy-schema-shape.js';

if (process.env.CONFIRM_MIGRATION_BASELINE !== 'yes' ||
    process.env.CONFIRM_VERIFIED_DATABASE_BACKUP !== 'yes' ||
    process.env.CONFIRM_LEGACY_BASELINE_ONLY !== 'yes') {
  throw new Error('Abbruch: Für die historische Baseline sind CONFIRM_MIGRATION_BASELINE=yes, CONFIRM_VERIFIED_DATABASE_BACKUP=yes und CONFIRM_LEGACY_BASELINE_ONLY=yes ausdrücklich erforderlich.');
}

try {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL fehlt.');
  const client = await pool.connect();
  try {
    // Fail closed before any baseline DDL or ledger writes, including if a
    // required old column was manually changed but CREATE TABLE IF NOT EXISTS
    // would otherwise silently ignore the mismatch.
    await client.query("BEGIN TRANSACTION READ ONLY");
    try {
      await assertHistoricalBaselineShape(client);
    } finally {
      await client.query("ROLLBACK");
    }
    await baselineMigrations(client, legacyBaselineFiles, loadMigrationSql);
  } finally {
    client.release();
  }
} finally {
  await closeDatabase();
}
