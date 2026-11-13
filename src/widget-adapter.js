import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";
import { widgetConfigs, nextWidgetData } from "./widget-publication.js";

const registry = [
  { key: "follower_goal", label: "TikTok Follower Goal", short_label: "FOLLOWER GOAL", provider: "tiktok", mode: "goal", source_kind: "profile", metric: "followers", canvas: { width: 620, height: 132 } },
  { key: "twitch_follow_alert", label: "Twitch Follow Alert", short_label: "FOLLOW ALERT", provider: "twitch", mode: "alert", source_kind: "live_bridge", metric: "followers", canvas: { width: 720, height: 180 } },
  { key: "twitch_latest_follower", label: "Latest Twitch Follower", short_label: "LATEST FOLLOWER", provider: "twitch", mode: "latest", source_kind: "live_bridge", metric: "followers", canvas: { width: 620, height: 132 } },
  { key: "twitch_live_timer", label: "Twitch Live Timer", short_label: "LIVE TIMER", provider: "twitch", mode: "timer", source_kind: "live_bridge", metric: "duration", canvas: { width: 620, height: 132 } },
  { key: "obs_overlay", label: "OBS Overlay", mode: "static", source_kind: "static", metric: "", canvas: { width: 1920, height: 1080 } },
  { key: "manual_counter", label: "Manueller Zähler", mode: "manual_counter", source_kind: "manual", metric: "counter", canvas: { width: 620, height: 132 } }
];

function widget(row) {
  const data = row.data || {};
  const { draft, published, changed } = widgetConfigs(data, row.status);
  const config = Object.keys(draft).length ? draft : { widgetType: data.widget_type || "follower_goal", canvas: { width: 620, height: 132 }, elements: [], settings: {}, data: {} };
  const hasPublicSnapshot = row.status === "published" && published && typeof published === "object" && !Array.isArray(published);
  return { id: row.id, name: row.name, widget_type: data.widget_type || config.widgetType || "follower_goal", status: hasPublicSnapshot ? "live" : "draft", version: row.version || 1, draft_config: config, published_config: published, has_unpublished_changes: changed, source_url: hasPublicSnapshot ? `/widgets/output.html?widget=${encodeURIComponent(row.id)}` : "", source_urls: hasPublicSnapshot ? { obs: `/widgets/output.html?widget=${encodeURIComponent(row.id)}` } : {}, created_at: row.created_at, updated_at: row.updated_at };
}

export async function listWidgets(req) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const result = await getPool().query("select id, name, data, status, version, created_at, updated_at from creator_projects where account_id = $1 and kind = 'widget' and status <> 'archived' order by updated_at desc", [account.id]);
  const maxWidgets = account.plan === "free" ? 3 : account.plan === "creator" ? 25 : 100;
  return { widgets: result.rows.map(widget), registry, limits: { max_widgets: maxWidgets }, entitlements: { plan: account.plan || "free" }, tiktok: { connected: false }, live: { connected: false } };
}

export async function createWidget(req, body) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "INVALID_WIDGET_REQUEST", status: 400 };
  const type = registry.some(item => item.key === body.widget_type) ? body.widget_type : "follower_goal";
  const spec = registry.find(item => item.key === type);
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim() || body.name.length > 160)) return { error: "INVALID_WIDGET_NAME", status: 400 };
  if (body.template_key !== undefined && (typeof body.template_key !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(body.template_key))) return { error: "INVALID_WIDGET_TEMPLATE", status: 400 };
  const config = { widgetType: type, templateKey: body.template_key || "cfs-standard", canvas: spec.canvas, elements: [], settings: {}, data: {} };
  const name = (body.name || `${spec.label} · Entwurf`).trim();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize widget creation per account so parallel requests cannot exceed plan limits.
    const locked = (await client.query("select plan from accounts where id=$1 for update", [account.id])).rows[0];
    if (!locked) {
      await client.query("ROLLBACK");
      return { error: "AUTHENTICATION_REQUIRED", status: 401 };
    }
    const plan = locked.plan || "free";
    const maxWidgets = plan === "free" ? 3 : plan === "creator" ? 25 : 100;
    const countResult = await client.query("select count(*)::int as count from creator_projects where account_id = $1 and kind = 'widget' and status <> 'archived'", [account.id]);
    if (Number(countResult.rows[0]?.count || 0) >= maxWidgets) {
      await client.query("ROLLBACK");
      return { error: "WIDGET_LIMIT_REACHED", message: `Dein ${plan} Plan erlaubt maximal ${maxWidgets} Widgets.`, status: 402, limits: { max_widgets: maxWidgets }, entitlements: { plan } };
    }
    const result = await client.query("insert into creator_projects (account_id, kind, name, data) values ($1, 'widget', $2, $3::jsonb) returning id, name, data, status, version, created_at, updated_at", [account.id, name, JSON.stringify({ widget_type: type, config })]);
    await client.query("COMMIT");
    return { widget: widget(result.rows[0]), registry, tiktok: { connected: false }, live: { connected: false } };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

export async function getWidget(req, id) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const result = await getPool().query("select id, name, data, status, version, created_at, updated_at from creator_projects where id = $1 and account_id = $2 and kind = 'widget' and status <> 'archived'", [id, account.id]);
  return result.rows[0] ? { widget: widget(result.rows[0]), registry, tiktok: { connected: false }, live: { connected: false } } : { error: "WIDGET_NOT_FOUND", status: 404 };
}

export async function updateWidget(req, id, body, publish = false) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "INVALID_WIDGET_REQUEST", status: 400 };
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim() || body.name.length > 160)) return { error: "INVALID_WIDGET_NAME", status: 400 };
  if (body.config !== undefined) {
    if (!body.config || typeof body.config !== "object" || Array.isArray(body.config)) return { error: "INVALID_WIDGET_CONFIG", status: 400 };
    if (body.config.elements !== undefined && (!Array.isArray(body.config.elements) || body.config.elements.length > 100)) return { error: "INVALID_WIDGET_ELEMENTS", status: 400 };
    if (body.config.canvas !== undefined && (!body.config.canvas || typeof body.config.canvas !== "object" || Array.isArray(body.config.canvas))) return { error: "INVALID_WIDGET_CANVAS", status: 400 };
    if (body.config.settings !== undefined && (!body.config.settings || typeof body.config.settings !== "object" || Array.isArray(body.config.settings))) return { error: "INVALID_WIDGET_SETTINGS", status: 400 };
    if (Buffer.byteLength(JSON.stringify(body.config), "utf8") > 512 * 1024) return { error: "WIDGET_CONFIG_TOO_LARGE", status: 413 };
  }
  if (body.expected_version !== undefined && (!Number.isSafeInteger(body.expected_version) || body.expected_version < 1)) return { error: "INVALID_WIDGET_VERSION", status: 400 };
  const pool = getPool();
  const found = await pool.query("select id, name, data, status, version, created_at, updated_at from creator_projects where id = $1 and account_id = $2 and kind = 'widget' and status <> 'archived'", [id, account.id]);
  const row = found.rows[0];
  if (!row) return { error: "WIDGET_NOT_FOUND", status: 404 };
  if (body.expected_version !== undefined && Number(body.expected_version) !== Number(row.version)) return { error: "WIDGET_VERSION_CONFLICT", status: 409 };
  const data = nextWidgetData(row.data || {}, body, publish, row.status);
  // The complete JSONB row contains both draft and published snapshots.
  // Bound the final stored representation, not only the incoming draft.
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, "utf8") > 512 * 1024) return { error: "WIDGET_DATA_TOO_LARGE", status: 413 };
  const result = await pool.query("update creator_projects set name = coalesce($3, name), data = $4::jsonb, status = case when $5 then 'published' else status end, version = version + 1, updated_at = now() where id = $1 and account_id = $2 and version = $6 returning id, name, data, status, version, created_at, updated_at", [id, account.id, body.name ? String(body.name).trim().slice(0, 160) : null, serialized, publish, row.version]);
  if (!result.rows[0]) return { error: "WIDGET_VERSION_CONFLICT", status: 409 };
  return { widget: widget(result.rows[0]), registry, tiktok: { connected: false }, live: { connected: false } };
}
