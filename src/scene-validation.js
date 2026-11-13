// Shared validation for scene drafts and OBS publications.
// Drafts may be incomplete; published scenes must contain usable widget placements.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const validNumber = (value, min, max) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export function validateSceneConfig(config, { publish = false } = {}) {
  if (!isObject(config)) return "INVALID_SCENE_CONFIG";
  if (config.profile !== undefined && !["landscape", "tiktok_vertical"].includes(config.profile)) return "INVALID_SCENE_PROFILE";
  if (config.canvas !== undefined) {
    if (!isObject(config.canvas)) return "INVALID_SCENE_CANVAS";
    for (const key of ["width", "height"]) {
      if (config.canvas[key] !== undefined && !validNumber(config.canvas[key], 1, 4000)) return "INVALID_SCENE_CANVAS";
    }
    if (config.canvas.background !== undefined &&
        (typeof config.canvas.background !== "string" ||
         !/^(?:transparent|#[0-9a-f]{3,8})$/i.test(config.canvas.background))) return "INVALID_SCENE_CANVAS";
  }
  if (config.items === undefined && !publish) return null;
  if (!Array.isArray(config.items) || config.items.length > 100) return "INVALID_SCENE_ITEMS";
  if (publish && !config.items.some(item => isObject(item) && item.visible !== false)) return "SCENE_HAS_NO_VISIBLE_WIDGETS";
  const seen = new Set();
  for (const item of config.items) {
    if (!isObject(item) || typeof item.widget_id !== "string" || !UUID.test(item.widget_id)) return "INVALID_SCENE_WIDGET";
    if (item.id !== undefined) {
      if (typeof item.id !== "string" || !/^[a-z0-9_-]{1,80}$/i.test(item.id) || seen.has(item.id)) return "INVALID_SCENE_ITEM_ID";
      seen.add(item.id);
    }
    for (const [key, min, max] of [
      ["x", -4000, 4000], ["y", -4000, 4000], ["scale", 0.1, 5],
      ["opacity", 0, 1], ["rotation", -360, 360], ["z_index", -1000, 1000]
    ]) {
      if (item[key] !== undefined && !validNumber(item[key], min, max)) return "INVALID_SCENE_ITEM_GEOMETRY";
    }
    if ((item.visible !== undefined && typeof item.visible !== "boolean") ||
        (item.locked !== undefined && typeof item.locked !== "boolean")) return "INVALID_SCENE_ITEM_PROPERTIES";
  }
  return null;
}
