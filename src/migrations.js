import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export const migrationFiles = [
  '001_initial.sql', '002_project_versions.sql', '003_creator_assets.sql',
  '004_account_plan.sql', '005_tiktok_oauth.sql', '006_twitch_oauth.sql',
  '007_playstation_catalog.sql', '008_launcher_devices.sql', '009_tool_jobs.sql',
  '010_user_media.sql', '011_creator_presets.sql', '012_commerce_orders.sql',
  '013_password_recovery.sql', '014_launcher_obs.sql', '015_account_mfa.sql',
  '016_email_verification.sql', '017_support_reports.sql', '018_creator_games.sql',
  '019_merch_reviews.sql', '020_public_live_control.sql', '021_creator_settings.sql',
  '022_mfa_login_challenges.sql', '023_mfa_recovery_rotation.sql', '024_mfa_totp_replay.sql', '025_mfa_challenge_issuance_limit.sql', '026_launcher_job_claims.sql'
];

export function loadMigrationSql(file) {
  return readFile(join(root, 'migrations', file), 'utf8');
}
