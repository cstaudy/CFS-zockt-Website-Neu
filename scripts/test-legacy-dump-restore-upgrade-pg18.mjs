import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";
import { baselineMigrations, applyMigrations } from "../src/migration-runner.js";
import { legacyBaselineFiles } from "../src/legacy-baseline-files.js";
import { migrationFiles, loadMigrationSql } from "../src/migrations.js";

// Deliberately destructive, but ONLY on CI-created ephemeral databases.
// Do not accept connection strings or database names supplied by a caller.
const CI_URL = "postgresql://cfs_ci:ci_test_only_password@127.0.0.1:5432/cfs_ci";
if (process.env.CFS_CI_DATABASE_ACCEPTANCE !== "yes" ||
    process.env.DATABASE_URL !== CI_URL) {
  throw new Error("REFUSED: legacy dump upgrade requires the exact disposable CI database.");
}
const containers = execFileSync("docker", [
  "ps", "--filter", "ancestor=postgres:18", "--format", "{{.ID}}"
], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
assert.equal(containers.length, 1, "Expected exactly one PostgreSQL 18 CI container");
const container = containers[0];

const nonce = randomBytes(5).toString("hex");
const sourceName = `cfs_ci_legacy_backup_${nonce}_source`;
const cloneName = `cfs_ci_legacy_backup_${nonce}_clone`;
const clientFor = name => new pg.Client({
  connectionString: `postgresql://cfs_ci:ci_test_only_password@127.0.0.1:5432/${name}`,
  ssl: false
});
const quote = value => `"${value.replaceAll('"', '""')}"`;
const admin = clientFor("cfs_ci");
let source, clone;
let createdSource = false;
let createdClone = false;

// Compare ALL original application tables and original columns. A later
// additive migration introduces new account_mfa columns, which must not
// obscure modifications to data in the pre-existing columns.
async function legacyRows(client, definition) {
  const result = {};
  for (const [table, columns] of definition) {
    const originalColumns = columns.map(quote).join(", ");
    const query = `
      select count(*)::integer as count,
        md5(coalesce(string_agg(row_to_json(t)::text, chr(10)
          order by row_to_json(t)::text), '')) as digest
      from (select ${originalColumns} from public.${quote(table)}) t`;
    const row = (await client.query(query)).rows[0];
    result[table] = { count: row.count, digest: row.digest };
  }
  return result;
}
async function originalSchema(client) {
  const rows = (await client.query(`
    select table_name, column_name from information_schema.columns
    where table_schema='public' and table_name <> 'schema_migrations'
    order by table_name, ordinal_position
  `)).rows;
  const tables = new Map();
  for (const row of rows) {
    if (!tables.has(row.table_name)) tables.set(row.table_name, []);
    tables.get(row.table_name).push(row.column_name);
  }
  return tables;
}
const assertHistoryCount = async (client, expected) => {
  const count = (await client.query("select count(*)::integer as total from schema_migrations")).rows[0].total;
  assert.equal(count, expected);
};
try {
  await admin.connect();
  await admin.query(`create database ${quote(sourceName)}`);
  createdSource = true;
  await admin.query(`create database ${quote(cloneName)}`);
  createdClone = true;
  source = clientFor(sourceName);
  await source.connect();

  // Construct an actual legacy instance, with application data but no ledger.
  for (const file of legacyBaselineFiles) await source.query(await loadMigrationSql(file));
  assert.equal((await source.query("select to_regclass('public.schema_migrations') as history")).rows[0].history, null);
  const owner = (await source.query(`
    insert into accounts(email,display_name,role,password_hash)
    values('legacy-archive-ci@example.test','Legacy Account','creator','synthetic-hash')
    returning id
  `)).rows[0];
  await source.query("insert into sessions(account_id,token_hash,expires_at) values($1,'synthetic-token-hash',now()+interval '2 days')", [owner.id]);
  await source.query("insert into creator_projects(account_id,kind,name,data,status) values($1,'widget','Restored Widget',$2::jsonb,'published')", [owner.id, JSON.stringify({ text: "legacy overlay", version: 21 })]);
  await source.query("insert into account_mfa(account_id,secret,enabled,recovery_codes) values($1,'synthetic-secret',false,'[]'::jsonb)", [owner.id]);
  await source.query("insert into creator_settings(account_id,settings) values($1,$2::jsonb)", [owner.id, JSON.stringify({ theme: "legacy" })]);
  const original = await originalSchema(source);
  assert(original.size >= 20, "Legacy snapshot should include all application tables");
  const before = await legacyRows(source, original);
  assert.equal(before.accounts.count, 1);
  assert.equal(before.sessions.count, 1);
  assert.equal(before.creator_projects.count, 1);
  assert.equal(before.account_mfa.count, 1);

  // Take a real pg_dump of the old, untracked database; restore the archive
  // to a distinct, initially empty database, never into the source.
  const archive = execFileSync("docker", [
    "exec", container, "pg_dump", "-U", "cfs_ci", "-d", sourceName,
    "-Fc", "--no-owner", "--no-acl"
  ], { maxBuffer: 32 * 1024 * 1024 });
  assert(archive.length > 1024, "Old database dump archive must not be empty");
  const archiveHash = createHash("sha256").update(archive).digest("hex");
  assert.match(archiveHash, /^[a-f0-9]{64}$/);
  const listing = spawnSync("docker", [
    "exec", "-i", container, "pg_restore", "--list"
  ], { input: archive, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(listing.status, 0, "Old database dump must be readable");
  const restored = spawnSync("docker", [
    "exec", "-i", container, "pg_restore", "-U", "cfs_ci", "-d", cloneName,
    "--no-owner", "--no-acl", "--exit-on-error"
  ], { input: archive, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(restored.status, 0, "Old database dump must restore into the clean clone");
  clone = clientFor(cloneName);
  await clone.connect();

  assert.equal((await clone.query("select to_regclass('public.schema_migrations') as history")).rows[0].history, null,
    "Restored legacy clone must not invent a migration ledger");
  assert.deepEqual(await originalSchema(clone), original, "Restored legacy table and column schema must match exactly");
  assert.deepEqual(await legacyRows(clone, original), before, "All legacy data must survive restore");

  // On the restored clone ONLY, perform the verified 21-item baseline and
  // then the four incremental MFA migrations.
  await assert.rejects(
    applyMigrations(clone, migrationFiles, loadMigrationSql),
    /Bestehende Datenbank ohne Migrationshistorie/
  );
  await baselineMigrations(clone, legacyBaselineFiles, loadMigrationSql);
  await assertHistoryCount(clone, 21);
  assert.deepEqual(await legacyRows(clone, original), before, "Baseline must not mutate restored data");
  await applyMigrations(clone, migrationFiles, loadMigrationSql);
  await assertHistoryCount(clone, 25);
  assert.deepEqual(await legacyRows(clone, original), before, "Upgrade must preserve every preexisting table and column");

  const additions = (await clone.query(`
    select column_name from information_schema.columns
    where table_schema='public' and table_name='account_mfa'
      and column_name in ('recovery_rotated_at','last_login_totp_step',
                          'login_challenge_window_started_at','login_challenge_window_count')
    order by column_name
  `)).rows.map(row => row.column_name);
  assert.deepEqual(additions, [
    "last_login_totp_step", "login_challenge_window_count",
    "login_challenge_window_started_at", "recovery_rotated_at"
  ]);
  assert((await clone.query("select to_regclass('public.mfa_login_challenges') as table_name")).rows[0].table_name);
  await applyMigrations(clone, migrationFiles, loadMigrationSql);
  await assertHistoryCount(clone, 25);

  // Confirm the original source still has its old schema and data: the
  // rehearsal's upgrade must only ever affect the fresh restore clone.
  assert.equal((await source.query("select to_regclass('public.schema_migrations') as history")).rows[0].history, null);
  assert.equal((await source.query("select to_regclass('public.mfa_login_challenges') as table_name")).rows[0].table_name, null);
  assert.deepEqual(await legacyRows(source, original), before);
  console.log("PostgreSQL 18 legacy dump rehearsal passed: real archive, clean restore, all legacy rows preserved, 21-item baseline, MFA 022-025, source unchanged.");
} finally {
  try { if (clone) await clone.end(); } finally {
    try { if (source) await source.end(); } finally {
      try {
        // Names are generated here, never read from the environment.
        if (createdClone) await admin.query(`drop database ${quote(cloneName)} with (force)`);
        if (createdSource) await admin.query(`drop database ${quote(sourceName)} with (force)`);
      } finally {
        await admin.end();
      }
    }
  }
}
