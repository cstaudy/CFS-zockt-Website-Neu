import { createHash } from "node:crypto";
import { migrationFiles, loadMigrationSql } from "./migrations.js";

// Catalog-only inspection. No account records, credentials, personal data, or
// application rows are read, and no changes are ever applied by this module.
const catalogSql = `
  select
    to_regclass('public.accounts') is not null as accounts_exists,
    to_regclass('public.schema_migrations') is not null as ledger_exists,
    to_regclass('public.mfa_login_challenges') is not null as mfa_login_challenges_exists,
    exists (
      select 1 from information_schema.columns
       where table_schema='public' and table_name='account_mfa'
         and column_name='recovery_rotated_at'
    ) as mfa_recovery_rotation_exists,
    exists (
      select 1 from information_schema.columns
       where table_schema='public' and table_name='account_mfa'
         and column_name='last_login_totp_step'
    ) as mfa_totp_replay_exists,
    exists (
      select 1 from information_schema.columns
       where table_schema='public' and table_name='account_mfa'
         and column_name='login_challenge_window_started_at'
    ) as mfa_challenge_window_exists,
    exists (
      select 1 from information_schema.columns
       where table_schema='public' and table_name='account_mfa'
         and column_name='login_challenge_window_count'
    ) as mfa_challenge_count_exists,
    exists (
      select 1 from information_schema.columns
       where table_schema='public' and table_name='tool_jobs'
         and column_name='claimed_by_device'
    ) as launcher_claim_device_exists,
    to_regclass('public.twitch_follow_subscriptions') is not null as twitch_subscriptions_exists,
    to_regclass('public.twitch_follow_challenges') is not null as twitch_challenges_exists,
    to_regclass('public.twitch_follow_events') is not null as twitch_follow_events_exists
`;

const boolKeys = [
  "accounts_exists", "ledger_exists", "mfa_login_challenges_exists",
  "mfa_recovery_rotation_exists", "mfa_totp_replay_exists",
  "mfa_challenge_window_exists", "mfa_challenge_count_exists",
  "launcher_claim_device_exists", "twitch_subscriptions_exists",
  "twitch_challenges_exists", "twitch_follow_events_exists"
];

function verifiedRow(result) {
  if (result?.rows?.length !== 1) throw new Error("RELEASE_PREFLIGHT_CATALOG_UNAVAILABLE");
  const row = result.rows[0];
  if (!row || boolKeys.some(key => typeof row[key] !== "boolean"))
    throw new Error("RELEASE_PREFLIGHT_CATALOG_INVALID");
  return row;
}

async function compareMigrationLedger(db) {
  const actual = await db.query("select name, checksum from public.schema_migrations order by name");
  if (!Array.isArray(actual?.rows)) throw new Error("RELEASE_PREFLIGHT_LEDGER_INVALID");
  const expected = new Map();
  for (const name of migrationFiles) {
    expected.set(name, createHash("sha256")
      .update(await loadMigrationSql(name)).digest("hex"));
  }
  const names = new Set();
  const unknown = [], modified = [];
  for (const row of actual.rows) {
    if (typeof row?.name !== "string" || typeof row?.checksum !== "string" ||
        names.has(row.name)) throw new Error("RELEASE_PREFLIGHT_LEDGER_INVALID");
    names.add(row.name);
    if (!expected.has(row.name)) unknown.push(row.name);
    else if (expected.get(row.name) !== row.checksum) modified.push(row.name);
  }
  return {
    entries: names.size,
    pending: migrationFiles.filter(name => !names.has(name)),
    unknown,
    modified
  };
}

export async function inspectReleaseReadiness(db) {
  if (!db || typeof db.query !== "function") throw new Error("RELEASE_PREFLIGHT_DATABASE_REQUIRED");
  const catalog = verifiedRow(await db.query(catalogSql));
  const schema = {
    mfa_login_challenges: catalog.mfa_login_challenges_exists,
    mfa_recovery_rotation: catalog.mfa_recovery_rotation_exists,
    mfa_totp_replay: catalog.mfa_totp_replay_exists,
    mfa_challenge_window: catalog.mfa_challenge_window_exists &&
      catalog.mfa_challenge_count_exists,
    launcher_026_device_claim: catalog.launcher_claim_device_exists,
    twitch_027_follow_subscriptions: catalog.twitch_subscriptions_exists,
    twitch_027_follow_challenges: catalog.twitch_challenges_exists,
    twitch_027_follow_events: catalog.twitch_follow_events_exists
  };
  let history = "missing";
  let entries = 0;
  let pending = [...migrationFiles], unknown = [], modified = [];
  if (catalog.ledger_exists) {
    const ledger = await compareMigrationLedger(db);
    ({ entries, pending, unknown, modified } = ledger);
    history = entries === 0 ? "empty" :
      unknown.length || modified.length ? "inconsistent" :
      pending.length ? "incomplete" : "verified";
  }
  const blockers = [];
  if (!catalog.accounts_exists) blockers.push("APPLICATION_SCHEMA_NOT_PRESENT");
  if (catalog.accounts_exists && !catalog.ledger_exists)
    blockers.push("LEGACY_MIGRATION_BASELINE_REQUIRED");
  if (catalog.ledger_exists && history !== "verified") {
    if (history === "empty") blockers.push("MIGRATION_LEDGER_EMPTY");
    if (pending.length) blockers.push("MIGRATION_FILES_NOT_RECORDED");
    if (unknown.length || modified.length) blockers.push("MIGRATION_LEDGER_CONFLICT");
  }
  if (!schema.mfa_login_challenges || !schema.mfa_recovery_rotation ||
      !schema.mfa_totp_replay || !schema.mfa_challenge_window)
    blockers.push("MFA_SCHEMA_022_025_INCOMPLETE");
  const noMigrationOnStartup = blockers.length === 0;
  return {
    ok: true,
    read_only: true,
    application_schema_exists: catalog.accounts_exists,
    migration_history: history,
    migration_ledger_entries: entries,
    migration_files_expected: migrationFiles.length,
    pending_migration_files: pending,
    unknown_migration_files: unknown,
    checksum_mismatch_files: modified,
    schema,
    database_ready_for_nonmigrating_start: noMigrationOnStartup,
    blockers,
    // An exclusively database-based check cannot verify backup+restore,
    // staging isolation, admin access, provider credentials, or actual rollout.
    production_release_approved: false,
    external_acceptance_required: [
      "ISOLATED_VERIFIED_BACKUP_RESTORE",
      "STAGING_DATABASE_ISOLATION",
      "OPERATOR_ADMIN_AND_MFA_CHECK",
      "REAL_DEVICE_AND_PROVIDER_ACCEPTANCE",
      "EXPLICIT_DEPLOY_APPROVAL"
    ]
  };
}
