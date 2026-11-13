import { closeDatabase, getPool } from "../src/db.js";
import { adminReadiness } from "../src/admin-readiness.js";

// This command may read a real database only after an explicit operator opt-in.
// It never writes to accounts, sessions, or any other application table.
if (process.env.CONFIRM_ADMIN_PREFLIGHT_READ_ONLY !== "yes") {
  throw new Error("Admin-Preflight verweigert: CONFIRM_ADMIN_PREFLIGHT_READ_ONLY=yes fehlt.");
}
if (!process.env.DATABASE_URL) throw new Error("Admin-Preflight verweigert: DATABASE_URL fehlt.");

try {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    try {
      const status = await adminReadiness(client);
      await client.query("ROLLBACK");
      // Intentionally no email, account id, credential, or session details.
      console.log(JSON.stringify(status));
      if (!status.ready) process.exitCode = 2;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    }
  } finally {
    client.release();
  }
} finally {
  await closeDatabase();
}
