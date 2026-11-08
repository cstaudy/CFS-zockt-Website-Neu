import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";

function scene(row) {
  const data = row.data && typeof row.data === "object" ? row.data : {};
  return {
    id: row.id,
    name: row.name,
    profile: data.profile || "landscape",
    status: row.status === "published" ? "live" : "draft",
    version: row.version || 1,
    draft_config: data.config || {},
    source_url: row.status === "published" ? `/widgets/scene.html?scene=${encodeURIComponent(row.id)}` : "",
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function listScenes(req) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const result = await getPool().query("select id, name, data, status, version, created_at, updated_at from creator_projects where account_id = $1 and kind = 'scene' and status <> 'archived' order by updated_at desc", [account.id]);
  return { scenes: result.rows.map(scene), widgets: [], limits: { max_scenes: 50 }, entitlements: {} };
}

export async function createScene(req, body) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const name = String(body.name || "Neue Scene").trim().slice(0, 160) || "Neue Scene";
  const profile = body.profile === "tiktok_vertical" ? "tiktok_vertical" : "landscape";
  const data = { profile, config: body.config && typeof body.config === "object" ? body.config : {} };
  const result = await getPool().query("insert into creator_projects (account_id, kind, name, data) values ($1, 'scene', $2, $3::jsonb) returning id, name, data, status, version, created_at, updated_at", [account.id, name, JSON.stringify(data)]);
  return { scene: scene(result.rows[0]) };
}

export async function updateScene(req, id, body, publish = false) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const pool = getPool();
  const result = await pool.query("select id, name, data, status, version, created_at, updated_at from creator_projects where id = $1 and account_id = $2 and kind = 'scene'", [id, account.id]);
  const row = result.rows[0];
  if (!row) return { error: "SCENE_NOT_FOUND", status: 404 };
  if (body.expected_version !== undefined && Number(body.expected_version) !== Number(row.version)) return { error: "SCENE_VERSION_CONFLICT", status: 409 };
  const data = { ...(row.data || {}), profile: body.profile || row.data?.profile || "landscape", config: body.config || row.data?.config || {} };
  const next = await pool.query("update creator_projects set name = coalesce($3, name), data = $4::jsonb, status = case when $5 then 'published' else status end, version = version + 1, updated_at = now() where id = $1 and account_id = $2 returning id, name, data, status, version, created_at, updated_at", [id, account.id, body.name ? String(body.name).trim().slice(0, 160) : null, JSON.stringify(data), publish]);
  return { scene: scene(next.rows[0]) };
}

