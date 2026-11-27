import { maintenanceEnabled } from "../src/maintenance-mode.js";

if (process.env.DATABASE_URL && !maintenanceEnabled()) {
  await import("./migrate.js");
}
await import("../server.js");

