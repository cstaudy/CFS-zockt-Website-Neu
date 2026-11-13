import { createHash, timingSafeEqual } from "node:crypto";
import { getPool } from "./db.js";

// Launcher calls require both the bridge credential and a paired, active device.
// Use constant-time verification; retain support for existing non-empty bridge secrets.
// Secret rotation / minimum strength changes require separate operational rollout.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function launcherAuthorized(req) {
  const expected = process.env.LAUNCHER_BRIDGE_SECRET;
  const supplied = req?.headers?.["x-cfs-launcher-secret"];
  if (typeof expected !== "string" || expected.length === 0 || typeof supplied !== "string") return false;
  const expectedDigest = createHash("sha256").update(expected).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

export async function activeLauncherDevice(req) {
  if (!launcherAuthorized(req)) return { error: "LAUNCHER_UNAUTHORIZED", status: 401 };
  const id = req?.headers?.["x-cfs-device-id"];
  if (typeof id !== "string" || !UUID.test(id)) return { error: "DEVICE_ID_REQUIRED", status: 400 };
  const result = await getPool().query(
    "update launcher_devices set last_seen_at=now(),updated_at=now() where id=$1 and status='active' and account_id is not null returning id,account_id",
    [id]
  );
  return result.rows[0] || { error: "DEVICE_NOT_ACTIVE", status: 403 };
}
