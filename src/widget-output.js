import { getPool } from "./db.js";
import { widgetConfigs } from "./widget-publication.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ELEMENTS = new Set(["text", "counter", "progress", "shape", "image", "video", "chat"]);
const ALLOWED_SETTINGS = new Set(["goal", "manualValue", "offlineBehavior", "manualTimerSeconds", "manualTimerRunning", "manualTimerUpdatedAt", "chatMessageTimeoutMs"]);

export function publicWidgetPayload(row) {
  if (!row || row.status !== "published") return null;
  const data = row.data || {};
  const { published } = widgetConfigs(data, row.status);
  if (!published || typeof published !== "object" || Array.isArray(published)) return null;
  // Explicit projection: never serialize arbitrary project data, credentials or draft.
  const config = {
    canvas: published.canvas && typeof published.canvas === "object" ? {
      width: published.canvas.width, height: published.canvas.height, background: published.canvas.background
    } : {},
    elements: Array.isArray(published.elements)
      ? published.elements.filter(e => e && ALLOWED_ELEMENTS.has(e.type)).slice(0, 100).map(e => ({
          id: e.id, type: e.type, visible: e.visible, position: e.position,
          size: e.size, rotation: e.rotation, opacity: e.opacity, zIndex: e.zIndex,
          style: e.style, animation: e.animation, data: e.data
        }))
      : [],
    outputs: published.outputs && typeof published.outputs === "object" ? published.outputs : {},
    settings: Object.fromEntries(Object.entries(published.settings || {}).filter(([key]) => ALLOWED_SETTINGS.has(key)))
  };
  return { widget: { id: row.id, config, definition: { source_kind: "static", mode: "static" } }, data: { profile: {}, live: {}, bridge: {} } };
}

export async function getPublicWidget(id) {
  if (!UUID.test(String(id))) return { error: "WIDGET_NOT_FOUND", status: 404 };
  const result = await getPool().query(
    "select id, data, status from creator_projects where id=$1 and kind='widget' and status='published' limit 1",
    [id]
  );
  const payload = publicWidgetPayload(result.rows[0]);
  return payload ? { payload } : { error: "WIDGET_NOT_FOUND", status: 404 };
}
