import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PROJECTS = 50, MAX_BYTES = 512 * 1024;
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const toIso = date => date instanceof Date ? date.toISOString() : new Date(date).toISOString();
function cutProject(row) {
  const data = isObject(row.data) ? row.data : {};
  return { ...data, id: row.id, kind: "cut", name: row.name, title: row.name,
    status: row.status, data, version: row.version, created_at: row.created_at, updated_at: row.updated_at };
}
function requestData(body, update = false) {
  if (!isObject(body)) return { error: "INVALID_CUT_PROJECT_REQUEST", status: 400 };
  if (body.clips !== undefined || body.data !== undefined) return { error: "USE_ATOMIC_CUT_SAVE", status: 409 };
  if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim() || body.title.length > 160))
    return { error: "INVALID_PROJECT_NAME", status: 400 };
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim() || body.name.length > 160))
    return { error: "INVALID_PROJECT_NAME", status: 400 };
  if (body.format !== undefined && (typeof body.format !== "string" || body.format.length > 40))
    return { error: "INVALID_CUT_FORMAT", status: 400 };
  if (update && (typeof body.base_updated_at !== "string" || !Number.isFinite(Date.parse(body.base_updated_at))))
    return { error: "INVALID_CUT_PROJECT_REVISION", status: 400 };
  if (body.expected_version !== undefined && (!Number.isSafeInteger(body.expected_version) || body.expected_version < 1))
    return { error: "INVALID_CUT_PROJECT_REVISION", status: 400 };
  const { id, kind, version, updated_at, created_at, base_updated_at, expected_version,
    project_base_updated_at, ...fields } = body;
  return { fields, name: body.title?.trim() || body.name?.trim() || "Neues Cut Projekt" };
}
function tooLarge(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_BYTES;
}
export async function createCutProject(req, body) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const parsed = requestData(body);
  if (parsed.error) return parsed;
  const data = { ...parsed.fields, clips: [] };
  if (tooLarge(data)) return { error: "CUT_PROJECT_TOO_LARGE", status: 413 };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query("select id from accounts where id=$1 for update", [account.id]);
    if (!locked.rows[0]) { await client.query("ROLLBACK"); return { error: "AUTHENTICATION_REQUIRED", status: 401 }; }
    const count = await client.query(
      "select count(*)::int as count from creator_projects where account_id=$1 and kind='cut' and status <> 'archived'",
      [account.id]
    );
    if (Number(count.rows[0]?.count || 0) >= MAX_PROJECTS) {
      await client.query("ROLLBACK");
      return { error: "CUT_PROJECT_LIMIT_REACHED", status: 402 };
    }
    const inserted = await client.query(
      "insert into creator_projects(account_id,kind,name,data) values($1,'cut',$2,$3::jsonb) returning id,name,data,status,version,updated_at,created_at",
      [account.id,parsed.name,JSON.stringify(data)]
    );
    await client.query("COMMIT");
    return { ok: true, project: cutProject(inserted.rows[0]) };
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
}
async function changeCutProject(req, id, body, remove) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!UUID.test(String(id))) return { error: "PROJECT_NOT_FOUND", status: 404 };
  const parsed = requestData(body, true);
  if (parsed.error) return parsed;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "select id,name,data,status,version,updated_at,created_at from creator_projects where id=$1 and account_id=$2 and kind='cut' and status <> 'archived' for update",
      [id, account.id]
    );
    const row = found.rows[0];
    if (!row) { await client.query("ROLLBACK"); return { error: "PROJECT_NOT_FOUND", status: 404 }; }
    if (toIso(row.updated_at) !== body.base_updated_at ||
        (body.expected_version !== undefined && body.expected_version !== row.version)) {
      await client.query("ROLLBACK");
      return { error: "CUT_PROJECT_VERSION_CONFLICT", status: 409 };
    }
    const data = remove ? row.data : { ...row.data, ...parsed.fields, clips: row.data?.clips || [] };
    if (!remove && tooLarge(data)) {
      await client.query("ROLLBACK");
      return { error: "CUT_PROJECT_TOO_LARGE", status: 413 };
    }
    const updated = await client.query(
      "update creator_projects set name=$3,data=$4::jsonb,status=case when $5 then 'archived' else status end,version=version+1,updated_at=greatest(clock_timestamp(),updated_at + interval '1 millisecond') where id=$1 and account_id=$2 and kind='cut' and status <> 'archived' and version=$6 returning id,name,data,status,version,updated_at,created_at",
      [id,account.id,remove ? row.name : (body.title?.trim() || body.name?.trim() || row.name),JSON.stringify(data),remove,row.version]
    );
    if (!updated.rows[0]) {
      await client.query("ROLLBACK");
      return { error: "CUT_PROJECT_VERSION_CONFLICT", status: 409 };
    }
    await client.query("COMMIT");
    return remove ? { ok: true, deleted: true } : { ok: true, project: cutProject(updated.rows[0]) };
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
}
export function saveCutProject(req, id, body) {
  return changeCutProject(req, id, body, false);
}
export function archiveCutProject(req, id, body) {
  return changeCutProject(req, id, body, true);
}
