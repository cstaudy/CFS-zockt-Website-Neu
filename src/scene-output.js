import { getPool } from "./db.js";
import { widgetConfigs } from "./widget-publication.js";
import { publicWidgetPayload } from "./widget-output.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const number = (value, fallback, min, max) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const color = value => typeof value === "string" && /^(?:#[0-9a-f]{3,8}|transparent)$/i.test(value) ? value : "transparent";

// Public scenes expose only published, same-owner widgets and safe placement fields.
export function publicScenePayload(row, widgetRows = []) {
  if (!row || row.status !== "published") return null;
  const { published } = widgetConfigs(row.data || {}, row.status);
  if (!published || typeof published !== "object" || Array.isArray(published) || !Array.isArray(published.items)) return null;
  const profile = published.profile === "tiktok_vertical" ? "tiktok_vertical" : "landscape";
  const canvas = {
    width: number(published.canvas?.width, profile === "landscape" ? 1920 : 1080, 1, 4000),
    height: number(published.canvas?.height, profile === "landscape" ? 1080 : 1920, 1, 4000),
    background: color(published.canvas?.background)
  };
  const widgets = new Map(widgetRows
    .filter(w => w.account_id === row.account_id && w.status === "published")
    .map(w => [String(w.id).toLowerCase(), publicWidgetPayload(w)]));
  const items = published.items.slice(0, 100).filter(i => i && typeof i === "object" && !Array.isArray(i) && UUID.test(String(i.widget_id)) && i.visible !== false)
    .map((i, index) => {
      const widgetId = String(i.widget_id).toLowerCase();
      const payload = widgets.get(widgetId);
      if (!payload) return null;
      return {
        id: String(i.id ?? index).slice(0, 80),
        widget_id: widgetId,
        x: number(i.x, 0, -4000, 4000), y: number(i.y, 0, -4000, 4000),
        scale: number(i.scale, 1, 0.1, 5),
        opacity: number(i.opacity, 1, 0, 1),
        rotation: number(i.rotation, 0, -360, 360),
        z_index: number(i.z_index, index, -1000, 1000),
        width: payload.widget.config.canvas?.width || 620,
        height: payload.widget.config.canvas?.height || 132
      };
    }).filter(Boolean);
  if (!items.length) return null;
  return { scene: { id: row.id, profile, canvas, items } };
}

export async function getPublicScene(id) {
  if (!UUID.test(String(id))) return { error: "SCENE_NOT_FOUND", status: 404 };
  const pool = getPool();
  const found = await pool.query(
    "select id, account_id, data, status from creator_projects where id=$1 and kind='scene' and status='published' limit 1",
    [id]
  );
  const row = found.rows[0];
  if (!row) return { error: "SCENE_NOT_FOUND", status: 404 };
  const { published } = widgetConfigs(row.data || {}, row.status);
  if (!published || !Array.isArray(published.items)) return { error: "SCENE_NOT_FOUND", status: 404 };
  const ids = [...new Set(published.items.slice(0, 100).map(item => String(item?.widget_id || "").toLowerCase()).filter(value => UUID.test(value)))];
  if (!ids.length) return { error: "SCENE_NOT_FOUND", status: 404 };
  const widgets = await pool.query(
    "select id, account_id, data, status from creator_projects where account_id=$1 and kind='widget' and status='published' and id = any($2::uuid[])",
    [row.account_id, ids]
  );
  const payload = publicScenePayload(row, widgets.rows);
  return payload ? { payload } : { error: "SCENE_NOT_FOUND", status: 404 };
}
