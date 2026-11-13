import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";
import { launcherAuthorized, UUID as LAUNCHER_UUID } from "./launcher-auth.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PENDING = 3;
const MAX_PAYLOAD_BYTES = 64 * 1024;
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

function view(row) {
  return { id: row.id, project_id: row.project_id, kind: row.kind, status: row.status,
    payload: row.payload || {}, result: row.result || null, error: row.error || null,
    created_at: row.created_at, updated_at: row.updated_at };
}
export async function listJobs(req) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const result = await getPool().query(
    "select id,project_id,kind,status,payload,result,error,created_at,updated_at from tool_jobs where account_id=$1 and kind like 'cut_%' order by created_at desc limit 50",
    [account.id]
  );
  return { ok: true, jobs: result.rows.map(view), limits: { max_pending_jobs: MAX_PENDING } };
}

export async function createJob(req, projectId, kind, payload = {}) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!UUID.test(String(projectId))) return { error: "PROJECT_NOT_FOUND", status: 404 };
  if (kind !== "cut_export" || !isObject(payload)) return { error: "INVALID_EXPORT_JOB", status: 400 };
  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > MAX_PAYLOAD_BYTES)
    return { error: "EXPORT_JOB_TOO_LARGE", status: 413 };

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Serialize concurrent requests for an account before counting pending jobs.
    const locked = await client.query("select id from accounts where id=$1 for update", [account.id]);
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      return { error: "AUTHENTICATION_REQUIRED", status: 401 };
    }
    const project = await client.query(
      "select id from creator_projects where id=$1 and account_id=$2 and kind='cut' and status <> 'archived'",
      [projectId, account.id]
    );
    if (!project.rows[0]) {
      await client.query("ROLLBACK");
      return { error: "PROJECT_NOT_FOUND", status: 404 };
    }
    const pending = await client.query(
      "select count(*)::int as count from tool_jobs where account_id=$1 and status in ('queued','claimed','processing')",
      [account.id]
    );
    if (Number(pending.rows[0]?.count || 0) >= MAX_PENDING) {
      await client.query("ROLLBACK");
      return { error: "JOB_LIMIT_REACHED", status: 429 };
    }
    const result = await client.query(
      "insert into tool_jobs(account_id,project_id,kind,payload) values($1,$2,$3,$4::jsonb) returning id,project_id,kind,status,payload,result,error,created_at,updated_at",
      [account.id, projectId, kind, JSON.stringify(payload)]
    );
    await client.query("COMMIT");
    return { ok: true, job: view(result.rows[0]) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

export async function cancelJob(req, id) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!UUID.test(String(id))) return { error: "JOB_NOT_FOUND_OR_RUNNING", status: 409 };
  const result = await getPool().query(
    "update tool_jobs set status='canceled',updated_at=now() where id=$1 and account_id=$2 and kind='cut_export' and status in ('queued','claimed') returning id,project_id,kind,status,payload,result,error,created_at,updated_at",
    [id, account.id]
  );
  return result.rows[0] ? { ok: true, job: view(result.rows[0]) }
    : { error: "JOB_NOT_FOUND_OR_RUNNING", status: 409 };
}

export async function claimJobs(req) {
  if (!launcherAuthorized(req)) return { error: "LAUNCHER_UNAUTHORIZED", status: 401 };
  const deviceId = req?.headers?.["x-cfs-device-id"];
  if (typeof deviceId !== "string" || !LAUNCHER_UUID.test(deviceId))
    return { error: "DEVICE_ID_REQUIRED", status: 400 };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Hold the device lock through the claim. Revocation cannot slip between
    // the active-device check and assignment of a queued job.
    const active = await client.query(
      "update launcher_devices set last_seen_at=now(),updated_at=now() where id=$1 and status='active' and account_id is not null returning id,account_id",
      [deviceId]
    );
    const device = active.rows[0];
    if (!device) {
      await client.query("ROLLBACK");
      return { error: "DEVICE_NOT_ACTIVE", status: 403 };
    }
    const result = await client.query(
      "with next_job as (select id from tool_jobs where account_id=$1 and kind='cut_export' and status='queued' order by created_at for update skip locked limit 1) update tool_jobs set status='claimed',updated_at=now() where id in (select id from next_job) and account_id=$1 and kind='cut_export' and status='queued' returning id,project_id,kind,status,payload,result,error,created_at,updated_at",
      [device.account_id]
    );
    await client.query("COMMIT");
    return { ok: true, jobs: result.rows.map(view) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

// The existing schema has no claimed_by_device column. Until migration 026 is
// explicitly approved, updates may be made by *active devices of the owning
// account*, never by a device belonging to another account. The transaction
// holds the device row lock through the job update to serialize revocation.
export async function updateLauncherJob(req, id, body) {
  if (!launcherAuthorized(req)) return { error: "LAUNCHER_UNAUTHORIZED", status: 401 };
  const deviceId = req?.headers?.["x-cfs-device-id"];
  if (typeof deviceId !== "string" || !LAUNCHER_UUID.test(deviceId))
    return { error: "DEVICE_ID_REQUIRED", status: 400 };
  if (!UUID.test(String(id))) return { error: "JOB_NOT_FOUND_OR_NOT_CLAIMED", status: 409 };
  if (!isObject(body) || !["processing", "completed", "failed", "canceled"].includes(body.status))
    return { error: "INVALID_JOB_UPDATE", status: 400 };
  if (body.result !== undefined && body.result !== null && !isObject(body.result))
    return { error: "INVALID_JOB_RESULT", status: 400 };
  const resultJson = JSON.stringify(body.result ?? null);
  if (Buffer.byteLength(resultJson, "utf8") > MAX_PAYLOAD_BYTES)
    return { error: "JOB_RESULT_TOO_LARGE", status: 413 };
  if (body.error !== undefined && body.error !== null && typeof body.error !== "string")
    return { error: "INVALID_JOB_ERROR", status: 400 };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const active = await client.query(
      "update launcher_devices set last_seen_at=now(),updated_at=now() where id=$1 and status='active' and account_id is not null returning account_id",
      [deviceId]
    );
    if (!active.rows[0]) {
      await client.query("ROLLBACK");
      return { error: "DEVICE_NOT_ACTIVE", status: 403 };
    }
    const result = await client.query(
      "update tool_jobs set status=$3,result=$4::jsonb,error=$5,updated_at=now() where id=$1 and account_id=$2 and kind='cut_export' and (status='claimed' or (status='processing' and $3 <> 'processing')) returning id,project_id,kind,status,payload,result,error,created_at,updated_at",
      [id, active.rows[0].account_id, body.status, resultJson, body.error?.slice(0, 1000) || null]
    );
    await client.query("COMMIT");
    return result.rows[0] ? { ok: true, job: view(result.rows[0]) }
      : { error: "JOB_NOT_FOUND_OR_NOT_CLAIMED", status: 409 };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}
