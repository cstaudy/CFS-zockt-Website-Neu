import assert from "node:assert/strict";
import { maintenanceAllows, maintenanceEnabled, maintenancePayload } from "../src/maintenance-mode.js";

assert.equal(maintenanceEnabled({ CFS_MAINTENANCE_MODE: "true" }), true);
assert.equal(maintenanceEnabled({ CFS_MAINTENANCE_MODE: "TRUE" }), true);
assert.equal(maintenanceEnabled({ CFS_MAINTENANCE_MODE: "false" }), false);
assert.equal(maintenanceAllows("/api/health"), true);
assert.equal(maintenanceAllows("/api/ready"), true);
assert.equal(maintenanceAllows("/api/integrations/status"), true);
assert.equal(maintenanceAllows("/api/public/status"), true);
assert.equal(maintenanceAllows("/api/account/me"), false);
assert.equal(maintenanceAllows("/api/launcher/jobs"), false);
assert.deepEqual(maintenancePayload(), {
  error: "MAINTENANCE_MODE",
  message: "Die Website befindet sich für einen sicheren Datenbankwechsel im Wartungsmodus.",
  retry_after_seconds: 300
});
console.log("Maintenance mode: fail-closed API write/read boundary and health allowlist passed.");
