import { getPool } from "./db.js";
import { randomUUID } from "node:crypto";
import { requireAccount } from "./projects.js";

const streamFilter = kind => kind === "stream" ? " and coalesce(data->>'type','') <> 'stream_maker'" : "";
function view(row){const data=row.data&&typeof row.data==="object"&&!Array.isArray(row.data)?row.data:{};return{...data,id:row.id,title:row.name,name:row.name,kind:row.kind,status:row.status,data,version:row.version||1,updated_at:row.updated_at,created_at:row.created_at};}
export async function listToolProjects(req,kind){const a=await requireAccount(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};const r=await getPool().query("select id,name,kind,status,data,version,created_at,updated_at from creator_projects where account_id=$1 and kind=$2 and status <> 'archived'${streamFilter(kind)} order by updated_at desc",[a.id,kind]);return{ok:true,projects:r.rows.map(view),limits:{max_projects:50,max_clips_per_project:100,max_pending_jobs:3}};}
export async function getToolProject(req,kind,id){const a=await requireAccount(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};const r=await getPool().query("select id,name,kind,status,data,version,created_at,updated_at from creator_projects where id=$1 and account_id=$2 and kind=$3 and status <> 'archived'${streamFilter(kind)}",[id,a.id,kind]);return r.rows[0]?{ok:true,project:view(r.rows[0]),...(kind==="cut"?{clips:Array.isArray(r.rows[0].data?.clips)?r.rows[0].data.clips:[]}:{})}:{error:"PROJECT_NOT_FOUND",status:404};}
export async function saveToolProject(req,kind,id,body){const a=await requireAccount(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};const name=String(body.title||body.name||`Neues ${kind}-Projekt`).trim().slice(0,160)||`Neues ${kind}-Projekt`;const data=body.data||body.config||body;if(kind==="stream"&&data?.type==="stream_maker")return{error:"USE_STREAM_MAKER_API",status:409};const pool=getPool();if(id){const r=await pool.query("update creator_projects set name=$3,data=$4::jsonb,version=version+1,updated_at=now() where id=$1 and account_id=$2 and kind=$5 and status <> 'archived'${streamFilter(kind)} returning id,name,kind,status,data,version,created_at,updated_at",[id,a.id,name,JSON.stringify(data),kind]);return r.rows[0]?{ok:true,project:view(r.rows[0])}:{error:"PROJECT_NOT_FOUND",status:404};}const r=await pool.query("insert into creator_projects(account_id,kind,name,data) values($1,$2,$3,$4::jsonb) returning id,name,kind,status,data,version,created_at,updated_at",[a.id,kind,name,JSON.stringify(data)]);return{ok:true,project:view(r.rows[0])};}
export async function deleteToolProject(req,kind,id){const a=await requireAccount(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};const r=await getPool().query("update creator_projects set status='archived',version=version+1,updated_at=now() where id=$1 and account_id=$2 and kind=$3${streamFilter(kind)} returning id",[id,a.id,kind]);return r.rowCount?{ok:true,deleted:true}:{error:"PROJECT_NOT_FOUND",status:404};}
async function cutRow(req,id){const a=await requireAccount(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id)))return{error:"PROJECT_NOT_FOUND",status:404};const r=await getPool().query("select id,name,kind,status,data,version,created_at,updated_at from creator_projects where id=$1 and account_id=$2 and kind='cut' and status <> 'archived'",[id,a.id]);return r.rows[0]?{account:a,row:r.rows[0]}:{error:"PROJECT_NOT_FOUND",status:404};}
export async function listClips(req,id){const found=await cutRow(req,id);if(found.error)return found;return{ok:true,clips:Array.isArray(found.row.data?.clips)?found.row.data.clips:[]};}

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const MAX_CLIPS = 100;
const MAX_CUT_BYTES = 512 * 1024;
const MAX_CLIP_MS = 24 * 60 * 60 * 1000;

function cleanClipInput(input) {
  const { id, updated_at, base_updated_at, project_base_updated_at, clip_base_updated_at,
    expected_version, ...fields } = input;
  return fields;
}
function validClipRange(start, end) {
  return Number.isSafeInteger(start) && start >= 0 &&
    Number.isSafeInteger(end) && end > start && end <= MAX_CLIP_MS;
}

// All legacy clip writes now lock their owning Cut project and return the
// *actual PostgreSQL* revision; no clock-skewed local timestamp is fabricated.
async function mutateClips(req, id, body, operation) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id)))
    return { error: "PROJECT_NOT_FOUND", status: 404 };
  if (!isObject(body)) return { error: "INVALID_CLIP_REQUEST", status: 400 };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "select id,data,version,updated_at from creator_projects where id=$1 and account_id=$2 and kind='cut' and status <> 'archived' for update",
      [id, account.id]
    );
    const row = result.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { error: "PROJECT_NOT_FOUND", status: 404 };
    }
    const submittedRevision = body.project_base_updated_at ?? body.base_updated_at;
    if (submittedRevision !== undefined &&
        (typeof submittedRevision !== "string" ||
         !Number.isFinite(Date.parse(submittedRevision)) ||
         Date.parse(submittedRevision) !== new Date(row.updated_at).getTime())) {
      await client.query("ROLLBACK");
      return { error: "CUT_PROJECT_VERSION_CONFLICT", status: 409 };
    }
    if (body.expected_version !== undefined && body.expected_version !== row.version) {
      await client.query("ROLLBACK");
      return { error: "CUT_PROJECT_VERSION_CONFLICT", status: 409 };
    }
    const clips = Array.isArray(row.data?.clips) ? [...row.data.clips] : [];
    const outcome = operation(clips, body);
    if (outcome.error) {
      await client.query("ROLLBACK");
      return outcome;
    }
    const serialized = JSON.stringify({ ...(isObject(row.data) ? row.data : {}), clips });
    if (Buffer.byteLength(serialized, "utf8") > MAX_CUT_BYTES) {
      await client.query("ROLLBACK");
      return { error: "CUT_PROJECT_TOO_LARGE", status: 413 };
    }
    const updated = await client.query(
      "update creator_projects set data=$3::jsonb,version=version+1,updated_at=greatest(clock_timestamp(),updated_at + interval '1 millisecond') where id=$1 and account_id=$2 and kind='cut' and status <> 'archived' and version=$4 returning version,updated_at",
      [id, account.id, serialized, row.version]
    );
    if (!updated.rows[0]) {
      await client.query("ROLLBACK");
      return { error: "CUT_PROJECT_VERSION_CONFLICT", status: 409 };
    }
    await client.query("COMMIT");
    return { ok: true, ...outcome, project_updated_at: updated.rows[0].updated_at,
      project_version: updated.rows[0].version };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

export async function createClip(req, id, body) {
  return mutateClips(req, id, body, (clips, input) => {
    if (clips.length >= MAX_CLIPS) return { error: "CLIP_LIMIT_REACHED", status: 422 };
    const start = input.in_ms === undefined ? 0 : input.in_ms;
    const end = input.out_ms === undefined ? 15000 : input.out_ms;
    if (!validClipRange(start, end)) return { error: "INVALID_CLIP_RANGE", status: 400 };
    const fields = cleanClipInput(input);
    const clip = { ...fields, id: randomUUID(),
      label: String(input.label || "Clip " + (clips.length + 1)).slice(0, 160),
      in_ms: start, out_ms: end, caption: String(input.caption || "").slice(0, 500),
      caption_enabled: input.caption_enabled === true, updated_at: new Date().toISOString() };
    clips.push(clip);
    return { clip };
  });
}

export async function updateClip(req, id, clipId, body) {
  return mutateClips(req, id, body, (clips, input) => {
    const index = clips.findIndex(clip => String(clip.id) === String(clipId));
    if (index < 0) return { error: "CLIP_NOT_FOUND", status: 404 };
    const current = clips[index];
    if (input.clip_base_updated_at !== undefined &&
        input.clip_base_updated_at !== current.updated_at)
      return { error: "CUT_CLIP_VERSION_CONFLICT", status: 409 };
    const fields = cleanClipInput(input);
    const start = fields.in_ms ?? current.in_ms ?? 0;
    const end = fields.out_ms ?? current.out_ms ?? 15000;
    if (!validClipRange(start, end)) return { error: "INVALID_CLIP_RANGE", status: 400 };
    const previousMs = Date.parse(current.updated_at || "");
    const nextMs = Math.max(Date.now(), Number.isFinite(previousMs) ? previousMs + 1 : 0);
    const clip = { ...current, ...fields, id: current.id, in_ms: start, out_ms: end,
      updated_at: new Date(nextMs).toISOString() };
    if (fields.label !== undefined) clip.label = String(fields.label).slice(0, 160);
    if (fields.caption !== undefined) clip.caption = String(fields.caption).slice(0, 500);
    clips[index] = clip;
    return { clip };
  });
}

export async function deleteClip(req, id, clipId, body = {}) {
  return mutateClips(req, id, body, (clips, input) => {
    const index = clips.findIndex(clip => String(clip.id) === String(clipId));
    if (index < 0) return { error: "CLIP_NOT_FOUND", status: 404 };
    if (input.clip_base_updated_at !== undefined &&
        input.clip_base_updated_at !== clips[index].updated_at)
      return { error: "CUT_CLIP_VERSION_CONFLICT", status: 409 };
    clips.splice(index, 1);
    return { deleted: true };
  });
}

export async function orderClips(req, id, body) {
  return mutateClips(req, id, body, (clips, input) => {
    if (!Array.isArray(input.clip_ids) || input.clip_ids.length !== clips.length ||
        input.clip_ids.some(x => typeof x !== "string") ||
        new Set(input.clip_ids).size !== clips.length)
      return { error: "INVALID_CUT_CLIP_ORDER", status: 400 };
    const byId = new Map(clips.map(clip => [String(clip.id), clip]));
    if (input.clip_ids.some(x => !byId.has(x)))
      return { error: "INVALID_CUT_CLIP_ORDER", status: 400 };
    clips.splice(0, clips.length, ...input.clip_ids.map(x => byId.get(x)));
    return { clips };
  });
}
