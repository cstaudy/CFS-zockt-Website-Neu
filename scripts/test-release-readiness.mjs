import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { inspectReleaseReadiness } from "../src/release-readiness.js";
import { migrationFiles, loadMigrationSql } from "../src/migrations.js";
import { expectedLegacySchema } from "../src/legacy-schema-shape.js";

const complete = {
  accounts_exists: true,
  ledger_exists: true,
  mfa_login_challenges_exists: true,
  mfa_recovery_rotation_exists: true,
  mfa_totp_replay_exists: true,
  mfa_challenge_window_exists: true,
  mfa_challenge_count_exists: true,
  launcher_claim_device_exists: false,
  twitch_subscriptions_exists: false,
  twitch_challenges_exists: false,
  twitch_follow_events_exists: false
};
const expectedLedger = await Promise.all(migrationFiles.map(async name => ({
  name, checksum: createHash("sha256")
    .update(await loadMigrationSql(name)).digest("hex")
})));
const baseline = await expectedLegacySchema();
const legacyColumns = [...baseline.entries()].flatMap(([table, cols]) =>
  [...cols.values()].map(col => ({ table_name: table, column_name: col.name,
    udt_name: col.type, is_nullable: col.not_null ? "NO" : "YES" })));
function fakeDb({ flags = {}, ledger = expectedLedger, catalogResult, ledgerResult,
  schemaRows = legacyColumns } = {}) {
  const queries = [];
  return {
    queries,
    async query(sql) {
      queries.push(sql);
      assert.match(sql.trim(), /^select\b/i, "Release inspector must only run SELECT");
      assert.doesNotMatch(sql, /\b(insert|update|delete|alter|drop|create|truncate)\s+(?:table|into|from|public|schema|\w)/i,
        "Readiness inspector must never mutate any DB object");
      if (sql.includes("to_regclass('public.accounts')"))
        return catalogResult === undefined ? { rows: [{ ...complete, ...flags }] } : catalogResult;
      if (sql.includes("from information_schema.columns") &&
          sql.includes("table_name <> 'schema_migrations'"))
        return { rows: schemaRows };
      if (sql.startsWith("select name, checksum from public.schema_migrations"))
        return ledgerResult === undefined ? { rows: ledger } : ledgerResult;
      throw new Error("Unexpected catalog query");
    }
  };
}

const goodDb = fakeDb();
const good = await inspectReleaseReadiness(goodDb);
assert.equal(good.read_only, true);
assert.equal(good.migration_history, "verified");
assert.equal(good.migration_ledger_entries, migrationFiles.length);
assert.equal(good.database_ready_for_nonmigrating_start, true);
assert.equal(good.production_release_approved, false,
  "Schema readiness never confirms an operational release");
assert.deepEqual(good.blockers, []);
assert.equal(good.schema.launcher_026_device_claim, false);
assert.equal(good.schema.twitch_027_follow_subscriptions, false);
assert.equal(goodDb.queries.length, 2);
assert(!JSON.stringify(good).includes("email"));
assert(!JSON.stringify(good).includes("password"));
assert(!JSON.stringify(good).includes("secret"));

const legacyDb = fakeDb({ flags: {
  ledger_exists: false,
  mfa_login_challenges_exists: false,
  mfa_recovery_rotation_exists: false,
  mfa_totp_replay_exists: false,
  mfa_challenge_window_exists: false,
  mfa_challenge_count_exists: false
} });
const legacy = await inspectReleaseReadiness(legacyDb);
assert.equal(legacy.migration_history, "missing");
assert.equal(legacy.database_ready_for_nonmigrating_start, false);
assert(legacy.blockers.includes("LEGACY_MIGRATION_BASELINE_REQUIRED"));
assert(legacy.blockers.includes("MFA_SCHEMA_022_025_INCOMPLETE"));
assert.equal(legacyDb.queries.length, 2,
  "Legacy DB inspects column metadata but never SELECTs a missing ledger");
assert.equal(legacy.legacy_schema_shape.matched, true);
assert.equal(legacy.legacy_schema_shape.expected_tables, 26);
assert.equal(legacy.legacy_schema_shape.full_equivalence_proven, false);

const noLedgerButSchema = await inspectReleaseReadiness(fakeDb({ flags: { ledger_exists: false } }));
assert(noLedgerButSchema.blockers.includes("LEGACY_MIGRATION_BASELINE_REQUIRED"),
  "Schema existence alone cannot authorize recording migration history");
const withMissing = legacyColumns.filter(x =>
  !(x.table_name === "accounts" && x.column_name === "role"));
const missingSchema = await inspectReleaseReadiness(fakeDb({
  flags: { ledger_exists: false }, schemaRows: withMissing
}));
assert(missingSchema.blockers.includes("LEGACY_SCHEMA_SHAPE_DRIFT"));
assert(missingSchema.legacy_schema_shape.missing_columns.includes("accounts.role"));
const wrongType = await inspectReleaseReadiness(fakeDb({
  flags: { ledger_exists: false },
  schemaRows: legacyColumns.map(col => col.table_name === "accounts" &&
    col.column_name === "role" ? { ...col, udt_name: "int4" } : col)
}));
assert(wrongType.blockers.includes("LEGACY_SCHEMA_SHAPE_DRIFT"));
assert(wrongType.legacy_schema_shape.incompatible_columns.includes("accounts.role"));
const extraColumn = await inspectReleaseReadiness(fakeDb({
  flags: { ledger_exists: false },
  schemaRows: [...legacyColumns, { table_name: "accounts", column_name: "untracked",
    udt_name: "text", is_nullable: "YES" }]
}));
assert(extraColumn.blockers.includes("LEGACY_SCHEMA_SHAPE_DRIFT"));
assert(extraColumn.legacy_schema_shape.unexpected_columns.includes("accounts.untracked"));
const missingTable = await inspectReleaseReadiness(fakeDb({
  flags: { ledger_exists: false },
  schemaRows: legacyColumns.filter(col => col.table_name !== "creator_settings")
}));
assert(missingTable.legacy_schema_shape.missing_tables.includes("creator_settings"));
const emptyLedger = await inspectReleaseReadiness(fakeDb({ ledger: [] }));
assert(emptyLedger.blockers.includes("MIGRATION_LEDGER_EMPTY"));
assert.equal(emptyLedger.database_ready_for_nonmigrating_start, false);
const missingLast = await inspectReleaseReadiness(fakeDb({ ledger: expectedLedger.slice(0, -1) }));
assert(missingLast.blockers.includes("MIGRATION_FILES_NOT_RECORDED"));
assert.deepEqual(missingLast.pending_migration_files, [migrationFiles.at(-1)]);
const altered = await inspectReleaseReadiness(fakeDb({ ledger: [
  ...expectedLedger.slice(0, -1), { ...expectedLedger.at(-1), checksum: "tampered" }
] }));
assert(altered.blockers.includes("MIGRATION_LEDGER_CONFLICT"));
assert.deepEqual(altered.checksum_mismatch_files, [migrationFiles.at(-1)]);
const extra = await inspectReleaseReadiness(fakeDb({ ledger: [
  ...expectedLedger, { name: "999_unknown.sql", checksum: "not-known" }
] }));
assert(extra.blockers.includes("MIGRATION_LEDGER_CONFLICT"));
assert.deepEqual(extra.unknown_migration_files, ["999_unknown.sql"]);
await assert.rejects(
  inspectReleaseReadiness(fakeDb({ ledger: [...expectedLedger, expectedLedger[0]] })),
  /RELEASE_PREFLIGHT_LEDGER_INVALID/,
  "Duplicate ledger names must fail closed");
await assert.rejects(
  inspectReleaseReadiness(fakeDb({ catalogResult: { rows: [] } })),
  /RELEASE_PREFLIGHT_CATALOG_UNAVAILABLE/);
await assert.rejects(
  inspectReleaseReadiness(fakeDb({ catalogResult: { rows: [{ accounts_exists: true }] } })),
  /RELEASE_PREFLIGHT_CATALOG_INVALID/);
await assert.rejects(
  inspectReleaseReadiness(fakeDb({ ledgerResult: { rows: null } })),
  /RELEASE_PREFLIGHT_LEDGER_INVALID/);
const fresh = await inspectReleaseReadiness(fakeDb({ flags: {
  accounts_exists: false, ledger_exists: false, mfa_login_challenges_exists: false,
  mfa_recovery_rotation_exists: false, mfa_totp_replay_exists: false,
  mfa_challenge_window_exists: false, mfa_challenge_count_exists: false
} }));
assert(fresh.blockers.includes("APPLICATION_SCHEMA_NOT_PRESENT"));
assert.equal(fresh.database_ready_for_nonmigrating_start, false);

const blocked = spawnSync(process.execPath, ["scripts/check-release-readiness.mjs"], {
  encoding: "utf8",
  env: { ...process.env, CONFIRM_RELEASE_PREFLIGHT_READ_ONLY: "no", DATABASE_URL: "" }
});
assert.notEqual(blocked.status, 0);
assert.match(blocked.stderr, /CONFIRM_RELEASE_PREFLIGHT_READ_ONLY=yes/);
const missingUrl = spawnSync(process.execPath, ["scripts/check-release-readiness.mjs"], {
  encoding: "utf8",
  env: { ...process.env, CONFIRM_RELEASE_PREFLIGHT_READ_ONLY: "yes", DATABASE_URL: "" }
});
assert.notEqual(missingUrl.status, 0);
assert.match(missingUrl.stderr, /DATABASE_URL fehlt/);
console.log("Release readiness inspector: catalog-only, ledger checksums, old schema, missing MFA, conflicts, no PII, explicit opt-in, no writes.");
