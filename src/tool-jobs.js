import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";
import { activeLauncherDevice } from "./launcher-auth.js";

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
  const device = await activeLauncherDevice(req);
  if (device.error) return device;
  const result = await getPool().query(
    "with next_job as (select id from tool_jobs where account_id=$1 and status='queued' order by created_at for update skip locked limit 1) update tool_jobs set status='claimed',claimed_by_device=$2,updated_at=now() where id in (select id from next_job) and account_id=$1 and status='queued' returning id,project_id,kind,status,payload,result,error,created_at,updated_at",
    [device.account_id, device.id]
  );
  return { ok: true, jobs: result.rows.map(view) };
}

export async function updateLauncherJob(req, id, body) {
  const device = await activeLauncherDevice(req);
  if (device.error) return device;
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
  const result = await getPool().query(
    "update tool_jobs set status=$4,result=$5::jsonb,error=$6,updated_at=now() where id=$1 and account_id=$2 and claimed_by_device=$3 and (status='claimed' or (status='processing' and $4 <> 'processing')) returning id,project_id,kind,status,payload,result,error,created_at,updated_at",
    [id, device.account_id, device.id, body.status, resultJson, body.error?.slice(0, 1000) || null]
  );
  return result.rows[0] ? { ok: true, job: view(result.rows[0]) }
    : { error: "JOB_NOT_FOUND_OR_NOT_CLAIMED", status: 409 };
}
