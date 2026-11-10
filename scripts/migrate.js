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
  "018_creator_games.sql"
];

try {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL fehlt.");
  for (const file of files) {
    const sql = await readFile(join(root, "migrations", file), "utf8");
    await pool.query(sql);
    console.log(`migration ok: ${file}`);
  }
} finally {
  await closeDatabase();
}

