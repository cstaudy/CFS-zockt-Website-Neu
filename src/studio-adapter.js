import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";
import { widgetConfigs, nextWidgetData } from "./widget-publication.js";
import { publicWidgetPayload } from "./widget-output.js";
import { validateSceneConfig } from "./scene-validation.js";

const MAX_SCENES = 50;
const MAX_DATA_BYTES = 512 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

function scene(row) {
  const data = isObject(row.data) ? row.data : {};
  const { draft, published, changed } = widgetConfigs(data, row.status);
  const live = row.status === "published" && validateSceneConfig(published, { publish: true }) === null;
  return {
    id: row.id, name: row.name,
    profile: data.profile || "landscape",
    status: live ? "live" : "draft",
    version: row.version || 1,
    draft_config: draft,
    published_config: live ? published : null,
    has_unpublished_changes: changed,
    source_url: live ? `/widgets/scene.html?scene=${encodeURIComponent(row.id)}` : "",
    created_at: row.created_at, updated_at: row.updated_at
  };
}

function validateSceneRequest(body) {
  if (!isObject(body)) return "INVALID_SCENE_REQUEST";
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim() || body.name.length > 160)) return "INVALID_SCENE_NAME";
  if (body.profile !== undefined && !["landscape", "tiktok_vertical"].includes(body.profile)) return "INVALID_SCENE_PROFILE";
  if (body.config !== undefined) return validateSceneConfig(body.config);
  return null;
}

async function publishedWidgetsBelongToOwner(pool, accountId, config) {
  const ids = [...new Set(config.items.map(item => item.widget_id.toLowerCase()))];
  if (!ids.length) return false;
  const result = await pool.query(
    "select id, data, status from creator_projects where account_id=$1 and kind='widget' and status='published' and id=any($2::uuid[])",
    [accountId, ids]
  );
  const available = new Set(result.rows.filter(row => publicWidgetPayload(row)).map(row => String(row.id).toLowerCase()));
  return ids.every(id => available.has(id));
}

export async function listScenes(req) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const result = await getPool().query(
    "select id, name, data, status, version, created_at, updated_at from creator_projects where account_id=$1 and kind='scene' and status <> 'archived' order by updated_at desc",
    [account.id]
  );
  return { scenes: result.rows.map(scene), widgets: [], limits: { max_scenes: MAX_SCENES }, entitlements: {} };
}

export async function createScene(req, body) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const invalid = validateSceneRequest(body);
  if (invalid) return { error: invalid, status: 400 };
  const name = body.name?.trim() || "Neue Scene";
  const profile = body.profile || body.config?.profile || "landscape";
  const data = { profile, config: body.config || {} };
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, "utf8") > MAX_DATA_BYTES) return { error: "SCENE_DATA_TOO_LARGE", status: 413 };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Lock one account row to serialize concurrent scene creation against the quota.
    const accountRow = await client.query("select id from accounts where id=$1 for update", [account.id]);
    if (!accountRow.rows[0]) { await client.query("ROLLBACK"); return { error: "AUTHENTICATION_REQUIRED", status: 401 }; }
    const count = await client.query(
      "select count(*)::int as count from creator_projects where account_id=$1 and kind='scene' and status <> 'archived'",
      [account.id]
    );
    if (Number(count.rows[0]?.count || 0) >= MAX_SCENES) {
      await client.query("ROLLBACK");
      return { error: "SCENE_LIMIT_REACHED", status: 402, limits: { max_scenes: MAX_SCENES } };
    }
    const result = await client.query(
      "insert into creator_projects (account_id, kind, name, data) values ($1, 'scene', $2, $3::jsonb) returning id, name, data, status, version, created_at, updated_at",
      [account.id, name, serialized]
    );
    await client.query("COMMIT");
    return { scene: scene(result.rows[0]) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

export async function updateScene(req, id, body, publish = false) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!UUID.test(String(id))) return { error: "SCENE_NOT_FOUND", status: 404 };
  const invalid = validateSceneRequest(body);
  if (invalid) return { error: invalid, status: 400 };
  if (body.expected_version !== undefined && (!Number.isSafeInteger(body.expected_version) || body.expected_version < 1)) return { error: "INVALID_SCENE_VERSION", status: 400 };
  const pool = getPool();
  const found = await pool.query(
    "select id, name, data, status, version, created_at, updated_at from creator_projects where id=$1 and account_id=$2 and kind='scene' and status <> 'archived'",
    [id, account.id]
  );
  const row = found.rows[0];
  if (!row) return { error: "SCENE_NOT_FOUND", status: 404 };
  if (body.expected_version !== undefined && Number(body.expected_version) !== Number(row.version)) return { error: "SCENE_VERSION_CONFLICT", status: 409 };
  const data = nextWidgetData(row.data || {}, body, publish, row.status);
  data.profile = body.profile || data.draft_config?.profile || row.data?.profile || "landscape";
  if (publish) {
    const invalidPublished = validateSceneConfig(data.published_config, { publish: true });
    if (invalidPublished) return { error: invalidPublished, status: 400 };
    if (!await publishedWidgetsBelongToOwner(pool, account.id, data.published_config)) {
      return { error: "SCENE_WIDGET_NOT_PUBLISHED", status: 409 };
    }
  }
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, "utf8") > MAX_DATA_BYTES) return { error: "SCENE_DATA_TOO_LARGE", status: 413 };
  const next = await pool.query(
    "update creator_projects set name=coalesce($3,name),data=$4::jsonb,status=case when $5 then 'published' else status end,version=version+1,updated_at=now() where id=$1 and account_id=$2 and kind='scene' and status <> 'archived' and version=$6 returning id,name,data,status,version,created_at,updated_at",
    [id, account.id, body.name ? body.name.trim() : null, serialized, publish, row.version]
  );
  return next.rows[0] ? { scene: scene(next.rows[0]) } : { error: "SCENE_VERSION_CONFLICT", status: 409 };
}
