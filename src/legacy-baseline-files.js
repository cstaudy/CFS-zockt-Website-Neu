import { migrationFiles } from "./migrations.js";

// The legacy Render database predates the MFA login challenges. Only the
// historical schema (001–021) may be considered for an equivalence baseline.
// Never register 022+ as already applied unless their schema actually exists.
const lastLegacyMigration = "021_creator_settings.sql";
const legacyIndex = migrationFiles.indexOf(lastLegacyMigration);
if (legacyIndex !== 20 || migrationFiles.length <= legacyIndex + 1 ||
    migrationFiles[legacyIndex + 1] !== "022_mfa_login_challenges.sql") {
  throw new Error("Unexpected migration history: refusing legacy baseline.");
}

export const legacyBaselineFiles = Object.freeze(migrationFiles.slice(0, legacyIndex + 1));
export const pendingLegacyUpgradeFiles = Object.freeze(migrationFiles.slice(legacyIndex + 1));
