import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { legacyBaselineFiles, pendingLegacyUpgradeFiles } from "../src/legacy-baseline-files.js";
import { migrationFiles, loadMigrationSql } from "../src/migrations.js";
import { baselineMigrations } from "../src/migration-runner.js";

assert.equal(legacyBaselineFiles.length, 21);
assert.equal(legacyBaselineFiles.at(-1), "021_creator_settings.sql");
assert.deepEqual(pendingLegacyUpgradeFiles, [
  "022_mfa_login_challenges.sql",
  "023_mfa_recovery_rotation.sql",
  "024_mfa_totp_replay.sql",
  "025_mfa_challenge_issuance_limit.sql"
]);
assert.deepEqual([...legacyBaselineFiles, ...pendingLegacyUpgradeFiles], migrationFiles);

const safe = {
  inserts: [],
  async query(sql, params = []) {
    if (sql.startsWith("select name, checksum")) return { rows: [] };
    if (sql.startsWith("insert into schema_migrations")) this.inserts.push(params[0]);
    return { rows: [] };
  }
};
// The mocked schema fingerprint simulates an unchanged historical schema.
// In reality baselineMigrations compares actual PostgreSQL metadata before/after
// an entirely rolled-back probe.
await baselineMigrations(safe, legacyBaselineFiles, loadMigrationSql, async () => "same");
assert.deepEqual(safe.inserts, legacyBaselineFiles, "No pending MFA migration may be recorded as applied");

const noBackup = spawnSync(process.execPath, ["scripts/baseline-migrations.js"], {
  env: { ...process.env, DATABASE_URL: "", CONFIRM_MIGRATION_BASELINE: "yes",
    CONFIRM_LEGACY_BASELINE_ONLY: "yes", CONFIRM_VERIFIED_DATABASE_BACKUP: "no" },
  encoding: "utf8"
});
assert.notEqual(noBackup.status, 0);
assert.match(noBackup.stderr, /CONFIRM_VERIFIED_DATABASE_BACKUP=yes/);
const autoBaseline = spawnSync(process.execPath, ["scripts/start.js"], {
  env: { ...process.env, DATABASE_URL: "", MIGRATION_BASELINE_ON_START: "yes" },
  encoding: "utf8"
});
assert.notEqual(autoBaseline.status, 0);
assert.match(autoBaseline.stderr, /Automatic migration baselines are forbidden/);
console.log("Legacy baseline guard: only migrations 001-021, backup opt-in, and no startup baseline passed.");
