const allowedDuringMaintenance = new Set([
  "/api/health",
  "/api/ready",
  "/api/integrations/status",
  "/api/public/status"
]);

const blockedNonApiCallbacks = new Set([
  "/auth/tiktok/callback",
  "/auth/twitch/callback"
]);

export function maintenanceEnabled(env = process.env) {
  return String(env.CFS_MAINTENANCE_MODE || "").trim().toLowerCase() === "true";
}

export function maintenanceAllows(pathname) {
  return allowedDuringMaintenance.has(String(pathname || ""));
}

export function maintenanceBlocks(pathname) {
  const path = String(pathname || "");
  if (path.startsWith("/api/")) return !maintenanceAllows(path);
  return blockedNonApiCallbacks.has(path);
}

export function maintenancePayload() {
  return {
    error: "MAINTENANCE_MODE",
    message: "Die Website befindet sich für einen sicheren Datenbankwechsel im Wartungsmodus.",
    retry_after_seconds: 300
  };
}
