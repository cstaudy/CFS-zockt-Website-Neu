import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, closeDatabase } from "../src/db.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const files = [
  "001_initial.sql",
  "002_project_versions.sql",
  "003_creator_assets.sql",
  "004_account_plan.sql",
  "005_tiktok_oauth.sql",
  "006_twitch_oauth.sql",
  "007_playstation_catalog.sql",
  "008_launcher_devices.sql",
  "009_tool_jobs.sql",
  "010_user_media.sql",
  "011_creator_presets.sql",
  "012_commerce_orders.sql",
  "013_password_recovery.sql",
  "014_launcher_obs.sql",
  "015_account_mfa.sql",
  "016_email_verification.sql",
  "017_support_reports.sql",
  "018_creator_games.sql",
  "019_merch_reviews.sql",
  "020_public_live_control.sql",
  "021_creator_settings.sql"
];

try {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL fehlt.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('cfs-zockt:migrations'))");
    for (const file of files) {
      const sql = await readFile(join(root, "migrations", file), "utf8");
      await client.query(sql);
      console.log(`migration ok: ${file}`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
} finally {
  await closeDatabase();
}

