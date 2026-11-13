import { randomUUID } from "node:crypto";
import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const MAX_CLIPS = 100;
const MAX_BYTES = 512 * 1024;
const MAX_CLIP_MS = 24 * 60 * 60 * 1000;

function timestamp(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
function validRange(start, end) {
  return Number.isSafeInteger(start) && start >= 0 &&
    Number.isSafeInteger(end) && end > start && end <= MAX_CLIP_MS;
}
function payloadFields(input) {
  const { id, updated_at, base_updated_at, project_base_updated_at, expected_version, clip_base_updated_at, ...fields } = input;
  return fields;
}
// Every clip mutation locks its owning project, checks its persisted revision,
// and writes the complete timeline once. This prevents concurrent overwrites.
async function mutate(req, id, body, operation) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!UUID.test(String(id))) return { error: "PROJECT_NOT_FOUND", status: 404 };
  if (!isObject(body)) return { error: "INVALID_CLIP_REQUEST", status: 400 };
  const base = body.project_base_updated_at ?? body.base_updated_at;
  if (typeof base !== "string" || !Number.isFinite(Date.parse(base)) ||
      (body.expected_version !== undefined && (!Number.isSafeInteger(body.expected_version) || body.expected_version < 1))) {
    return { error: "INVALID_CUT_PROJECT_REVISION", status: 400 };
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "select id,data,version,updated_at from creator_projects where id=$1 and account_id=$2 and kind='cut' and status <> 'archived' for update",
      [id, account.id]
    );
    const row = found.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { error: "PROJECT_NOT_FOUND", status: 404 };
    }
    if (base !== timestamp(row.updated_at) ||
        (body.expected_version !== undefined && body.expected_version !== row.version)) {
      await client.query("ROLLBACK");
      return { error: "CUT_PROJECT_VERSION_CONFLICT", status: 409 };
    }
    const clips = Array.isArray(row.data?.clips) ? [...row.data.clips] : [];
    const outcome = operation(clips, body);
    if (outcome.error) {
      await client.query("ROLLBACK");
      return outcome;
    }
    const data = { ...row.data, clips };
    const serialized = JSON.stringify(data);
    if (Buffer.byteLength(serialized, "utf8") > MAX_BYTES) {
      await client.query("ROLLBACK");
      return { error: "CUT_PROJECT_TOO_LARGE", status: 413 };
    }
    const updated = await client.query(
      "update creator_projects set data=$3::jsonb,version=version+1,updated_at=greatest(clock_timestamp(), updated_at + interval '1 millisecond') where id=$1 and account_id=$2 and kind='cut' and status <> 'archived' and version=$4 returning updated_at,version",
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
  } finally {
    client.release();
  }
}
export async function createClip(req, id, body) {
  return mutate(req, id, body, (clips, input) => {
    if (clips.length >= MAX_CLIPS) return { error: "CLIP_LIMIT_REACHED", status: 422 };
    const start = input.in_ms === undefined ? 0 : input.in_ms;
    const end = input.out_ms === undefined ? 15000 : input.out_ms;
    if (!validRange(start, end)) return { error: "INVALID_CLIP_RANGE", status: 400 };
    const fields = payloadFields(input);
    const clip = { ...fields, id: randomUUID(),
      label: String(input.label || "Clip " + (clips.length + 1)).slice(0, 160),
      in_ms: start, out_ms: end, caption: String(input.caption || "").slice(0, 500),
      caption_enabled: input.caption_enabled === true, updated_at: new Date().toISOString() };
    clips.push(clip);
    return { clip };
  });
}
export async function updateClip(req, id, clipId, body) {
  return mutate(req, id, body, (clips, input) => {
    const index = clips.findIndex(clip => String(clip.id) === String(clipId));
    if (index < 0) return { error: "CLIP_NOT_FOUND", status: 404 };
    const current = clips[index];
    if (input.clip_base_updated_at !== current.updated_at && input.base_updated_at !== current.updated_at) {
      return { error: "CUT_CLIP_VERSION_CONFLICT", status: 409 };
    }
    const fields = payloadFields(input);
    const start = fields.in_ms ?? current.in_ms ?? 0;
    const end = fields.out_ms ?? current.out_ms ?? 15000;
    if (!validRange(start, end)) return { error: "INVALID_CLIP_RANGE", status: 400 };
    const currentTime = Date.parse(current.updated_at || 0);
    const nextTime = new Date(Math.max(Date.now(), (Number.isFinite(currentTime) ? currentTime : 0) + 1)).toISOString();
    const clip = { ...current, ...fields, id: current.id, in_ms: start, out_ms: end,
      updated_at: nextTime };
    if (fields.label !== undefined) clip.label = String(fields.label).slice(0, 160);
    if (fields.caption !== undefined) clip.caption = String(fields.caption).slice(0, 500);
    clips[index] = clip;
    return { clip };
  });
}
export async function deleteClip(req, id, clipId, body) {
  return mutate(req, id, body, (clips, input) => {
    const index = clips.findIndex(clip => String(clip.id) === String(clipId));
    if (index < 0) return { error: "CLIP_NOT_FOUND", status: 404 };
    if (input.clip_base_updated_at !== clips[index].updated_at)
      return { error: "CUT_CLIP_VERSION_CONFLICT", status: 409 };
    clips.splice(index, 1);
    return { deleted: true };
  });
}
export async function orderClips(req, id, body) {
  return mutate(req, id, body, (clips, input) => {
    if (!Array.isArray(input.clip_ids) || input.clip_ids.length !== clips.length ||
        input.clip_ids.some(value => typeof value !== "string")) {
      return { error: "INVALID_CUT_CLIP_ORDER", status: 400 };
    }
    const byId = new Map(clips.map(clip => [String(clip.id), clip]));
    if (new Set(input.clip_ids).size !== clips.length ||
        input.clip_ids.some(value => !byId.has(value))) {
      return { error: "INVALID_CUT_CLIP_ORDER", status: 400 };
    }
    clips.splice(0, clips.length, ...input.clip_ids.map(value => byId.get(value)));
    return { clips };
  });
}
