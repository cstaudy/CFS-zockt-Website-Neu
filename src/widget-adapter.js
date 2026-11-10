import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";

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
  const config = data.config || { widgetType: data.widget_type || "follower_goal", canvas: { width: 620, height: 132 }, elements: [], settings: {}, data: {} };
  return { id: row.id, name: row.name, widget_type: data.widget_type || config.widgetType || "follower_goal", status: row.status === "published" ? "live" : "draft", version: row.version || 1, draft_config: config, published_config: row.status === "published" ? config : null, has_unpublished_changes: false, source_url: row.status === "published" ? `/widgets/output.html?widget=${encodeURIComponent(row.id)}` : "", source_urls: row.status === "published" ? { obs: `/widgets/output.html?widget=${encodeURIComponent(row.id)}` } : {}, created_at: row.created_at, updated_at: row.updated_at };
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
  const pool = getPool();
  const countResult = await pool.query("select count(*)::int as count from creator_projects where account_id = $1 and kind = 'widget' and status <> 'archived'", [account.id]);
  const maxWidgets = account.plan === "free" ? 3 : account.plan === "creator" ? 25 : 100;
  if (Number(countResult.rows[0]?.count || 0) >= maxWidgets) return { error: "WIDGET_LIMIT_REACHED", message: `Dein ${account.plan || "free"} Plan erlaubt maximal ${maxWidgets} Widgets.`, status: 402, limits: { max_widgets: maxWidgets }, entitlements: { plan: account.plan || "free" } };
  const type = registry.some(item => item.key === body.widget_type) ? body.widget_type : "follower_goal";
  const spec = registry.find(item => item.key === type);
  const config = { widgetType: type, templateKey: body.template_key || "cfs-standard", canvas: spec.canvas, elements: [], settings: {}, data: {} };
  const name = String(body.name || `${spec.label} · Entwurf`).trim().slice(0, 160);
  const result = await pool.query("insert into creator_projects (account_id, kind, name, data) values ($1, 'widget', $2, $3::jsonb) returning id, name, data, status, version, created_at, updated_at", [account.id, name, JSON.stringify({ widget_type: type, config })]);
  return { widget: widget(result.rows[0]), registry, tiktok: { connected: false }, live: { connected: false } };
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
  const pool = getPool();
  const found = await pool.query("select id, name, data, status, version, created_at, updated_at from creator_projects where id = $1 and account_id = $2 and kind = 'widget' and status <> 'archived'", [id, account.id]);
  const row = found.rows[0];
  if (!row) return { error: "WIDGET_NOT_FOUND", status: 404 };
  if (body.expected_version !== undefined && Number(body.expected_version) !== Number(row.version)) return { error: "WIDGET_VERSION_CONFLICT", status: 409 };
  const data = { ...(row.data || {}), config: body.config || row.data?.config || {} };
  const result = await pool.query("update creator_projects set name = coalesce($3, name), data = $4::jsonb, status = case when $5 then 'published' else status end, version = version + 1, updated_at = now() where id = $1 and account_id = $2 returning id, name, data, status, version, created_at, updated_at", [id, account.id, body.name ? String(body.name).trim().slice(0, 160) : null, JSON.stringify(data), publish]);
  return { widget: widget(result.rows[0]), registry, tiktok: { connected: false }, live: { connected: false } };
}

