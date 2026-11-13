import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const MAX_BYTES = 512 * 1024;
function projectView(row) {
  const data = isObject(row.data) ? row.data : {};
  return { ...data, id:row.id, name:row.name, title:row.name, kind:"cut",
    status:row.status, data, version:row.version, created_at:row.created_at, updated_at:row.updated_at };
}
// Commit project fields and timeline clips in one transaction or change nothing.
export async function saveCutProjectAndClips(req, id, body) {
  const account = await requireAccount(req);
  if (!account) return { error:"AUTHENTICATION_REQUIRED", status:401 };
  if (!UUID.test(String(id))) return { error:"PROJECT_NOT_FOUND", status:404 };
  if (!isObject(body) || !isObject(body.project) || !Array.isArray(body.clips) ||
      body.clips.length > 100) return { error:"INVALID_CUT_SAVE_REQUEST", status:400 };
  const project = body.project;
  if (typeof project.title !== "string" || !project.title.trim() || project.title.length > 160)
    return { error:"INVALID_PROJECT_NAME", status:400 };
  if (!Number.isSafeInteger(project.expected_version) || project.expected_version < 1)
    return { error:"INVALID_CUT_PROJECT_VERSION", status:400 };
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "select id,name,data,status,version,created_at,updated_at from creator_projects where id=$1 and account_id=$2 and kind='cut' and status <> 'archived' for update",
      [id,account.id]
    );
    const row = found.rows[0];
    if (!row) { await client.query("ROLLBACK"); return { error:"PROJECT_NOT_FOUND", status:404 }; }
    if (row.version !== project.expected_version) {
      await client.query("ROLLBACK"); return { error:"CUT_PROJECT_VERSION_CONFLICT", status:409 };
    }
    const existing = Array.isArray(row.data?.clips) ? row.data.clips : [];
    if (body.clips.length !== existing.length) {
      await client.query("ROLLBACK"); return { error:"CUT_CLIP_SET_CONFLICT", status:409 };
    }
    const byId = new Map(existing.map(clip => [String(clip.id),clip]));
    const ids = new Set();
    const now = new Date().toISOString();
    const clips = [];
    for (const submitted of body.clips) {
      if (!isObject(submitted) || !UUID.test(String(submitted.id)) || ids.has(submitted.id)) {
        await client.query("ROLLBACK"); return { error:"INVALID_CUT_CLIP", status:400 };
      }
      const current = byId.get(submitted.id);
      if (!current || submitted.base_updated_at !== current.updated_at) {
        await client.query("ROLLBACK"); return { error:"CUT_CLIP_VERSION_CONFLICT", status:409 };
      }
      if (submitted.in_ms !== undefined && (!Number.isSafeInteger(submitted.in_ms) || submitted.in_ms < 0)) {
        await client.query("ROLLBACK"); return { error:"INVALID_CUT_CLIP_RANGE", status:400 };
      }
      if (submitted.out_ms !== undefined && (!Number.isSafeInteger(submitted.out_ms) ||
          submitted.out_ms <= (submitted.in_ms ?? current.in_ms ?? 0))) {
        await client.query("ROLLBACK"); return { error:"INVALID_CUT_CLIP_RANGE", status:400 };
      }
      ids.add(submitted.id);
      const { base_updated_at, id: clipId, updated_at, ...fields } = submitted;
      clips.push({ ...current, ...fields, id:clipId, updated_at:now });
    }
    const { base_updated_at, expected_version, id: suppliedId, data: suppliedData, clips: suppliedClips, ...fields } = project;
    const data = { ...row.data, ...fields, clips };
    const serialized = JSON.stringify(data);
    if (Buffer.byteLength(serialized, "utf8") > MAX_BYTES) {
      await client.query("ROLLBACK"); return { error:"CUT_PROJECT_TOO_LARGE", status:413 };
    }
    const updated = await client.query(
      "update creator_projects set name=$3,data=$4::jsonb,version=version+1,updated_at=now() where id=$1 and account_id=$2 and kind='cut' and status <> 'archived' and version=$5 returning id,name,data,status,version,created_at,updated_at",
      [id,account.id,project.title.trim(),serialized,row.version]
    );
    if (!updated.rows[0]) { await client.query("ROLLBACK"); return { error:"CUT_PROJECT_VERSION_CONFLICT", status:409 }; }
    await client.query("COMMIT");
    return { ok:true, project:projectView(updated.rows[0]), clips, project_updated_at:updated.rows[0].updated_at };
  } catch (error) { await client.query("ROLLBACK").catch(()=>{}); throw error; }
  finally { client.release(); }
}
