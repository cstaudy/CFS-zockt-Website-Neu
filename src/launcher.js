import { randomBytes } from "node:crypto";
import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";
import { UUID, launcherAuthorized, activeLauncherDevice } from "./launcher-auth.js";

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const LINK_CODE = /^[0-9a-f]{10}$/i;
function view(row) {
  return { id: row.id, machine_name: row.machine_name, client_version: row.client_version,
    status: row.status, online: Boolean(row.status === "active" && row.last_seen_at &&
      Date.now() - new Date(row.last_seen_at).getTime() < 120000),
    obs_connected: Boolean(row.obs_connected), obs_version: row.obs_version || null,
    last_seen_at: row.last_seen_at, created_at: row.created_at, updated_at: row.updated_at };
}
export async function registerDevice(req, body) {
  if (!launcherAuthorized(req)) return { error: "LAUNCHER_UNAUTHORIZED", status: 401 };
  if (!isObject(body)) return { error: "INVALID_DEVICE_REQUEST", status: 400 };
  if (body.machine_name !== undefined &&
      (typeof body.machine_name !== "string" || !body.machine_name.trim() || body.machine_name.length > 120))
    return { error: "INVALID_MACHINE_NAME", status: 400 };
  if (body.client_version !== undefined &&
      (typeof body.client_version !== "string" || body.client_version.length > 80))
    return { error: "INVALID_CLIENT_VERSION", status: 400 };
  const machine = body.machine_name?.trim() || "Creator PC";
  const version = body.client_version?.trim() || null;
  const code = randomBytes(5).toString("hex").toUpperCase();
  const result = await getPool().query(
    "insert into launcher_devices(machine_name,client_version,device_code,status,expires_at) values($1,$2,$3,'pending',now()+interval '15 minutes') returning id,machine_name,client_version,status,device_code,expires_at",
    [machine, version, code]
  );
  return { ok: true, device: { ...result.rows[0], user_code: result.rows[0].device_code }, poll_after_seconds: 3 };
}
export async function launcherHeartbeat(req, body = {}) {
  if (!isObject(body)) return { error: "INVALID_LAUNCHER_HEARTBEAT", status: 400 };
  const device = await activeLauncherDevice(req);
  if (device.error) return device;
  const specified = body.obs !== undefined;
  if (specified && (!isObject(body.obs) ||
      (body.obs.connected !== undefined && typeof body.obs.connected !== "boolean") ||
      (body.obs.version !== undefined && (typeof body.obs.version !== "string" || body.obs.version.length > 40))))
    return { error: "INVALID_OBS_STATUS", status: 400 };
  const result = await getPool().query(
    "update launcher_devices set last_seen_at=now(),updated_at=now(),obs_connected=case when $2 then $3 else obs_connected end,obs_version=case when $2 then $4 else obs_version end where id=$1 and status='active' and account_id=$5 returning id,machine_name,client_version,status,last_seen_at,obs_connected,obs_version,created_at,updated_at",
    [device.id, specified, body.obs?.connected === true, body.obs?.version?.trim() || null, device.account_id]
  );
  return result.rows[0] ? { ok: true, device: view(result.rows[0]) }
    : { error: "DEVICE_NOT_ACTIVE", status: 403 };
}
export async function listDevices(req) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const result = await getPool().query(
    "select id,machine_name,client_version,status,obs_connected,obs_version,last_seen_at,created_at,updated_at from launcher_devices where account_id=$1 order by updated_at desc",
    [account.id]
  );
  return { ok: true, devices: result.rows.map(view) };
}
export async function getDeviceLink(req, code) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (typeof code !== "string" || !LINK_CODE.test(code))
    return { error: "DEVICE_CODE_NOT_FOUND", status: 404 };
  const result = await getPool().query(
    "select id,machine_name,client_version,status,expires_at from launcher_devices where device_code=$1 and status='pending' and expires_at>now()",
    [code.toUpperCase()]
  );
  const row = result.rows[0];
  return row ? { ok: true, device_link: { id: row.id, machine_name: row.machine_name,
    client_version: row.client_version, status: row.status, expires_at: row.expires_at } }
    : { error: "DEVICE_CODE_NOT_FOUND", status: 404 };
}
export async function confirmDevice(req, body) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!isObject(body) || typeof body.user_code !== "string" || !LINK_CODE.test(body.user_code.trim()))
    return { error: "DEVICE_CODE_INVALID_OR_EXPIRED", status: 400 };
  const code = body.user_code.trim().toUpperCase();
  const result = await getPool().query(
    "update launcher_devices set account_id=$2,status='active',device_code=null,expires_at=null,updated_at=now() where device_code=$1 and status='pending' and expires_at>now() returning id,machine_name,client_version,status,last_seen_at,created_at,updated_at",
    [code, account.id]
  );
  return result.rows[0] ? { ok: true, device: view(result.rows[0]) }
    : { error: "DEVICE_CODE_INVALID_OR_EXPIRED", status: 400 };
}
export async function revokeDevice(req, id) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!UUID.test(String(id))) return { error: "DEVICE_NOT_FOUND", status: 404 };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "update launcher_devices set status='revoked',device_code=null,expires_at=null,obs_connected=false,obs_version=null,updated_at=now() where id=$1 and account_id=$2 and status='active' returning id",
      [id, account.id]
    );
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return { error: "DEVICE_NOT_FOUND", status: 404 };
    }
    // Claimed work can be claimed by another device. Work already processing
    // may have produced side effects, so fail it rather than duplicating an export.
    await client.query(
      "update tool_jobs set status='queued',claimed_by_device=null,updated_at=now() where account_id=$1 and claimed_by_device=$2 and status='claimed'",
      [account.id, id]
    );
    await client.query(
      "update tool_jobs set status='failed',error='Launcher device revoked during processing',updated_at=now() where account_id=$1 and claimed_by_device=$2 and status='processing'",
      [account.id, id]
    );
    await client.query("COMMIT");
    return { ok: true, revoked: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}
