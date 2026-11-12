import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { applyMigrations, baselineMigrations } from "../src/migration-runner.js";
import { legacyBaselineFiles, pendingLegacyUpgradeFiles } from "../src/legacy-baseline-files.js";
import { migrationFiles, loadMigrationSql } from "../src/migrations.js";

// This integration test is destructive, so it may ONLY run inside the disposable
// PostgreSQL service created by .github/workflows/check.yml, not Render/staging.
const ciUrl = "postgresql://cfs_ci:ci_test_only_password@127.0.0.1:5432/cfs_ci";
if (process.env.CFS_CI_DATABASE_ACCEPTANCE !== "yes" ||
    process.env.DATABASE_URL !== ciUrl) {
  throw new Error("REFUSED: legacy upgrade acceptance requires the exact disposable CI DB.");
}

const dbName = `cfs_ci_legacy_${randomBytes(6).toString("hex")}`;
const admin = new pg.Client({ connectionString: ciUrl, ssl: false });
let legacy;
let databaseCreated = false;
await admin.connect();
try {
  await admin.query(`create database "${dbName}"`);
  databaseCreated = true;
  legacy = new pg.Client({
    connectionString: `postgresql://cfs_ci:ci_test_only_password@127.0.0.1:5432/${dbName}`,
    ssl: false
  });
  await legacy.connect();

  assert.equal(legacyBaselineFiles.length, 21);
  assert.equal(pendingLegacyUpgradeFiles.length, 4);

  // Simulate the pre-migration-ledger production era: 001–021 were applied
  // directly, and no schema_migrations table exists.
  for (const file of legacyBaselineFiles) await legacy.query(await loadMigrationSql(file));
  assert.equal((await legacy.query("select to_regclass('public.schema_migrations') as name")).rows[0].name, null);
  assert.equal((await legacy.query("select to_regclass('public.mfa_login_challenges') as name")).rows[0].name, null);

  // Ensure an actually missing historical table cannot be silently baselined:
  // the rolled-back baseline probe would recreate it and detect schema drift.
  await legacy.query("drop table public.creator_settings");
  await assert.rejects(
    baselineMigrations(legacy, legacyBaselineFiles, loadMigrationSql),
    /Mindestens eine Migration würde das vorhandene Schema verändern/
  );
  assert.equal((await legacy.query("select to_regclass('public.schema_migrations') as name")).rows[0].name, null,
    "A failed baseline must not register a migration ledger");
  await legacy.query(await loadMigrationSql("021_creator_settings.sql"));

  // Synthetic legacy account, session, project, MFA configuration and settings
  // must survive the entire transition bit-for-bit.
  const account = (await legacy.query(
    `insert into accounts(email,display_name,role,password_hash)
     values('legacy-owner-ci@example.test','Legacy Owner','creator','synthetic-test-hash')
     returning id`
  )).rows[0];
  await legacy.query(
    "insert into sessions(account_id,token_hash,expires_at) values($1,'synthetic-legacy-token',now()+interval '3 days')",
    [account.id]
  );
  await legacy.query(
    "insert into creator_projects(account_id,kind,name,data) values($1,'widget','Legacy Overlay',$2::jsonb)",
    [account.id, JSON.stringify({ legacyMarker: "keep-me" })]
  );
  await legacy.query(
    "insert into account_mfa(account_id,secret,enabled,recovery_codes) values($1,'synthetic-only',false,'[]'::jsonb)",
    [account.id]
  );
  await legacy.query(
    "insert into creator_settings(account_id,settings) values($1,$2::jsonb)",
    [account.id, JSON.stringify({ legacySettings: "preserved" })]
  );
  const snapshot = async () => (await legacy.query(
    `select
       (select count(*)::int from accounts) as accounts,
       (select count(*)::int from sessions) as sessions,
       (select count(*)::int from creator_projects) as projects,
       (select count(*)::int from account_mfa) as mfa,
       (select count(*)::int from creator_settings) as settings,
       (select settings from creator_settings where account_id=$1) as creator_settings,
       (select data from creator_projects where account_id=$1) as project_data`,
    [account.id]
  )).rows[0];
  const before = await snapshot();

  // Regular migration startup MUST refuse the old, untracked schema.
  await assert.rejects(
    applyMigrations(legacy, migrationFiles, loadMigrationSql),
    /Bestehende Datenbank ohne Migrationshistorie/
  );
  assert.equal((await legacy.query("select to_regclass('public.schema_migrations') as name")).rows[0].name, null);
  assert.deepEqual(await snapshot(), before, "Guarded refusal must preserve account state");

  // Historical equivalence baseline records ONLY 001–021, without changing
  // any application data or pretending 022–025 are already installed.
  await baselineMigrations(legacy, legacyBaselineFiles, loadMigrationSql);
  assert.equal(Number((await legacy.query("select count(*) as n from schema_migrations")).rows[0].n), 21);
  assert.equal((await legacy.query("select to_regclass('public.mfa_login_challenges') as name")).rows[0].name, null);
  assert.deepEqual(await snapshot(), before, "Baseline must preserve legacy accounts and projects");

  // A repeated baseline should not modify the ledger or application rows.
  await baselineMigrations(legacy, legacyBaselineFiles, loadMigrationSql);
  assert.equal(Number((await legacy.query("select count(*) as n from schema_migrations")).rows[0].n), 21);

  // After the correct 21-item baseline, the normal migration runner may
  // apply the four pending MFA schema upgrades.
  await applyMigrations(legacy, migrationFiles, loadMigrationSql);
  const applied = (await legacy.query("select name from schema_migrations order by name")).rows.map(row => row.name);
  assert.deepEqual(applied, migrationFiles);
  assert.deepEqual(await snapshot(), before, "MFA schema upgrade must not change existing application data");
  assert((await legacy.query("select to_regclass('public.mfa_login_challenges') as name")).rows[0].name,
    "MFA challenges table must exist after upgrade");
  const newColumns = (await legacy.query(
    `select column_name from information_schema.columns
      where table_schema='public' and table_name='account_mfa'
      and column_name in ('recovery_rotated_at','last_login_totp_step',
                          'login_challenge_window_started_at','login_challenge_window_count')`
  )).rows.map(row => row.column_name).sort();
  assert.deepEqual(newColumns, [
    "last_login_totp_step",
    "login_challenge_window_count",
    "login_challenge_window_started_at",
    "recovery_rotated_at"
  ].sort());

  // All migrations must be safely repeatable on a second server startup.
  await applyMigrations(legacy, migrationFiles, loadMigrationSql);
  assert.equal(Number((await legacy.query("select count(*) as n from schema_migrations")).rows[0].n), 25);
  assert.deepEqual(await snapshot(), before);

  // A modified already-recorded migration is rejected by the checksum guard.
  await assert.rejects(
    applyMigrations(legacy, migrationFiles, file => file === "001_initial.sql"
      ? "select 'tampered';" : loadMigrationSql(file)),
    /Migration wurde nach Ausführung geändert/
  );
  assert.deepEqual(await snapshot(), before);

  console.log("PG18 real legacy upgrade passed: historical 001–021, schema-drift refusal, 21-item baseline, pending MFA 022–025, unchanged account data, idempotence and checksum guard.");
} finally {
  try { if (legacy) await legacy.end(); } finally {
    try {
      if (databaseCreated) await admin.query(`drop database "${dbName}" with (force)`);
    } finally {
      await admin.end();
    }
  }
}
