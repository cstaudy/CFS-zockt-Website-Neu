import { getPool, closeDatabase } from "../src/db.js";
import { inspectReleaseReadiness } from "../src/release-readiness.js";

// Deliberately NOT a startup hook. Only an operator with explicit read-only
// consent may inspect a selected database. This does not apply migrations.
if (process.env.CONFIRM_RELEASE_PREFLIGHT_READ_ONLY !== "yes") {
  throw new Error("Release-Preflight verweigert: CONFIRM_RELEASE_PREFLIGHT_READ_ONLY=yes fehlt.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("Release-Preflight verweigert: DATABASE_URL fehlt.");
}

try {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    try {
      const status = await inspectReleaseReadiness(client);
      await client.query("ROLLBACK");
      console.log(JSON.stringify(status));
      if (!status.database_ready_for_nonmigrating_start) process.exitCode = 2;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }
  } finally {
    client.release();
  }
} finally {
  await closeDatabase();
}
