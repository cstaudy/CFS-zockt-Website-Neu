import { getPool } from "./db.js";
import { widgetConfigs } from "./widget-publication.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Conservative public renderer subset: remote media and chat require separate URL/data policies.
const ALLOWED_ELEMENTS = new Set(["text", "counter", "progress", "shape"]);
const ALLOWED_SETTINGS = new Set(["goal", "manualValue", "offlineBehavior"]);
const safeNumber = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
const safeColor = value => typeof value === "string" && /^(?:#[0-9a-f]{3,8}|transparent|rgba?\\([0-9., %]+\\))$/i.test(value) ? value : "transparent";
function safeElement(e) {
  const st = e.style || {};
  return {
    id: String(e.id ?? "").slice(0, 80), type: e.type, visible: e.visible !== false,
    position: { x: safeNumber(e.position?.x, 0, -4000, 4000), y: safeNumber(e.position?.y, 0, -4000, 4000) },
    size: { width: safeNumber(e.size?.width, 100, 1, 4000), height: safeNumber(e.size?.height, 30, 1, 4000) },
    rotation: safeNumber(e.rotation, 0, -360, 360), opacity: safeNumber(e.opacity, 1, 0, 1), zIndex: safeNumber(e.zIndex, 0, -1000, 1000),
    style: { color: safeColor(st.color), backgroundColor: safeColor(st.backgroundColor), fillColor: safeColor(st.fillColor),
      borderColor: safeColor(st.borderColor), fontSize: safeNumber(st.fontSize, 20, 8, 180),
      fontWeight: safeNumber(st.fontWeight, 700, 100, 900), borderRadius: safeNumber(st.borderRadius, 0, 0, 500) },
    data: e.type === "text" ? { text: String(e.data?.text ?? "").slice(0, 1000) }
      : e.type === "counter" ? { format: String(e.data?.format ?? "{{current}}").slice(0, 200) }
      : e.type === "shape" ? { shape: e.data?.shape === "ellipse" ? "ellipse" : "rectangle" } : {}
  };
}

export function publicWidgetPayload(row) {
  if (!row || row.status !== "published") return null;
  const data = row.data || {};
  const { published } = widgetConfigs(data, row.status);
  if (!published || typeof published !== "object" || Array.isArray(published)) return null;
  // Explicit projection: never serialize arbitrary project data, credentials or draft.
  const config = {
    canvas: published.canvas && typeof published.canvas === "object" ? {
      width: safeNumber(published.canvas.width, 620, 1, 4000), height: safeNumber(published.canvas.height, 132, 1, 4000), background: safeColor(published.canvas.background)
    } : {},
    elements: Array.isArray(published.elements)
      ? published.elements.filter(e => e && ALLOWED_ELEMENTS.has(e.type)).slice(0, 100).map(safeElement)
      : [],
    outputs: {}, // placement settings require a separate validated schema
    settings: Object.fromEntries(Object.entries(published.settings && typeof published.settings === "object" ? published.settings : {}).filter(([key]) => ALLOWED_SETTINGS.has(key)).map(([key, value]) => [key, key === "offlineBehavior" ? (value === "zero" ? "zero" : "hold") : safeNumber(value, 0, 0, 1000000000)]))
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
