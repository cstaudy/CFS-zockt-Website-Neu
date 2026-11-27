import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { maintenanceAllows, maintenanceBlocks, maintenanceEnabled, maintenancePayload, maintenanceReadyPayload } from "../src/maintenance-mode.js";

const startScript = await readFile(new URL("./start.js", import.meta.url), "utf8");
const serverScript = await readFile(new URL("../server.js", import.meta.url), "utf8");

assert.equal(maintenanceEnabled({ CFS_MAINTENANCE_MODE: "true" }), true);
assert.equal(maintenanceEnabled({ CFS_MAINTENANCE_MODE: "TRUE" }), true);
assert.equal(maintenanceEnabled({ CFS_MAINTENANCE_MODE: "false" }), false);
assert.equal(maintenanceAllows("/api/health"), true);
assert.equal(maintenanceAllows("/api/ready"), true);
assert.equal(maintenanceAllows("/api/integrations/status"), true);
assert.equal(maintenanceAllows("/api/public/status"), true);
assert.equal(maintenanceAllows("/api/account/me"), false);
assert.equal(maintenanceAllows("/api/launcher/jobs"), false);
assert.equal(maintenanceBlocks("/api/health"), false);
assert.equal(maintenanceBlocks("/api/account/me"), true);
assert.equal(maintenanceBlocks("/auth/tiktok/callback"), true);
assert.equal(maintenanceBlocks("/auth/twitch/callback"), true);
assert.equal(maintenanceBlocks("/account.html"), false);
assert.deepEqual(maintenanceReadyPayload({ DATABASE_URL: "configured" }, "test"), {
  ok: true,
  status: "maintenance",
  checks: { configuration: true, database: { configured: true, connected: false, skipped: true } },
  version: "test"
});
assert.deepEqual(maintenanceReadyPayload({}, "test"), {
  ok: true,
  status: "maintenance",
  checks: { configuration: true, database: { configured: false, connected: false, skipped: true } },
  version: "test"
});
assert.match(startScript, /maintenanceEnabled/);
assert.match(startScript, /process\.env\.DATABASE_URL && !maintenanceEnabled\(\)/);
const maintenanceGate = serverScript.indexOf("if (maintenanceEnabled() && maintenanceBlocks(url.pathname))");
const healthRoute = serverScript.indexOf('if (url.pathname === "/api/health"');
const readyRoute = serverScript.indexOf('if (url.pathname === "/api/ready"');
const readyPayload = serverScript.indexOf("maintenanceReadyPayload", readyRoute);
const readyDatabaseCheck = serverScript.indexOf("databaseCheck()", readyRoute);
assert(maintenanceGate >= 0 && maintenanceGate < healthRoute, "maintenance gate must precede API routes");
assert(readyRoute >= 0 && readyPayload > readyRoute && readyPayload < readyDatabaseCheck, "maintenance readiness must skip the database check");
assert.deepEqual(maintenancePayload(), {
  error: "MAINTENANCE_MODE",
  message: "Die Website befindet sich für einen sicheren Datenbankwechsel im Wartungsmodus.",
  retry_after_seconds: 300
});
console.log("Maintenance mode: fail-closed API write/read boundary and health allowlist passed.");
