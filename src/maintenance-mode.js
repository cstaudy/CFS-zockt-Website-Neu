const allowedDuringMaintenance = new Set([
  "/api/health",
  "/api/ready",
  "/api/integrations/status",
  "/api/public/status"
]);

export function maintenanceEnabled(env = process.env) {
  return String(env.CFS_MAINTENANCE_MODE || "").trim().toLowerCase() === "true";
}

export function maintenanceAllows(pathname) {
  return allowedDuringMaintenance.has(String(pathname || ""));
}

export function maintenancePayload() {
  return {
    error: "MAINTENANCE_MODE",
    message: "Die Website befindet sich für einen sicheren Datenbankwechsel im Wartungsmodus.",
    retry_after_seconds: 300
  };
}
