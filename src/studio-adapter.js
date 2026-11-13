import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";
import { widgetConfigs, nextWidgetData } from "./widget-publication.js";

function scene(row) {
  const data = row.data && typeof row.data === "object" && !Array.isArray(row.data) ? row.data : {};
  const { draft, published, changed } = widgetConfigs(data, row.status);
  const live = row.status === "published" && published && typeof published === "object" && !Array.isArray(published);
  return {
    id: row.id,
    name: row.name,
    profile: data.profile || "landscape",
    status: live ? "live" : "draft",
    version: row.version || 1,
    draft_config: draft,
    published_config: live ? published : null,
    has_unpublished_changes: changed,
    source_url: live ? `/widgets/scene.html?scene=${encodeURIComponent(row.id)}` : "",
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
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "INVALID_SCENE_REQUEST", status: 400 };
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim() || body.name.length > 160)) return { error: "INVALID_SCENE_NAME", status: 400 };
  if (body.config !== undefined && (!body.config || typeof body.config !== "object" || Array.isArray(body.config) ||
      !Array.isArray(body.config.items) || body.config.items.length > 100)) return { error: "INVALID_SCENE_CONFIG", status: 400 };
  if (body.expected_version !== undefined && (!Number.isSafeInteger(body.expected_version) || body.expected_version < 1)) return { error: "INVALID_SCENE_VERSION", status: 400 };
  const pool = getPool();
  const found = await pool.query("select id, name, data, status, version, created_at, updated_at from creator_projects where id = $1 and account_id = $2 and kind = 'scene' and status <> 'archived'", [id, account.id]);
  const row = found.rows[0];
  if (!row) return { error: "SCENE_NOT_FOUND", status: 404 };
  if (body.expected_version !== undefined && Number(body.expected_version) !== Number(row.version)) return { error: "SCENE_VERSION_CONFLICT", status: 409 };
  const data = nextWidgetData(row.data || {}, body, publish, row.status);
  data.profile = body.profile === "tiktok_vertical" ? "tiktok_vertical" : body.profile === "landscape" ? "landscape" : data.profile || "landscape";
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, "utf8") > 512 * 1024) return { error: "SCENE_DATA_TOO_LARGE", status: 413 };
  const next = await pool.query(
    "update creator_projects set name = coalesce($3, name), data = $4::jsonb, status = case when $5 then 'published' else status end, version = version + 1, updated_at = now() where id = $1 and account_id = $2 and kind = 'scene' and status <> 'archived' and version = $6 returning id, name, data, status, version, created_at, updated_at",
    [id, account.id, body.name ? body.name.trim() : null, serialized, publish, row.version]
  );
  return next.rows[0] ? { scene: scene(next.rows[0]) } : { error: "SCENE_VERSION_CONFLICT", status: 409 };
}
