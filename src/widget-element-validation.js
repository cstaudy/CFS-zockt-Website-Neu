// Validate editor attributes before persisting drafts or publishing them.
// Keep these ranges aligned with the Creator Suite editor; public output
// applies its own more restrictive projection for OBS safety.
const ELEMENT_BOUNDS = Object.freeze({
  rotation: [-360, 360], opacity: [0, 1], zIndex: [-1000, 1000]
});
const STYLE_BOUNDS = Object.freeze({
  fontSize: [8, 200], fontWeight: [100, 900], letterSpacing: [-8, 30],
  gradientAngle: [0, 360], borderRadius: [0, 999],
  borderWidth: [0, 20], padding: [0, 100], shadowBlur: [0, 80],
  shadowX: [-80, 80], shadowY: [-80, 80], glowBlur: [0, 80],
  gap: [0, 40], avatarSize: [18, 80]
});
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const badNumber = (value, [min, max]) => typeof value !== "number" || !Number.isFinite(value) || value < min || value > max;

export function validateWidgetElementAttributes(elements) {
  if (!Array.isArray(elements)) return null; // The outer config validator handles this.
  for (const element of elements) {
    // The outer validator checks element shapes before calling this helper.
    if (!isObject(element)) return "INVALID_WIDGET_ELEMENT";
    for (const [key, bounds] of Object.entries(ELEMENT_BOUNDS)) {
      if (element[key] !== undefined && badNumber(element[key], bounds)) return "INVALID_WIDGET_ELEMENT_APPEARANCE";
    }
    if ((element.visible !== undefined && typeof element.visible !== "boolean") ||
        (element.locked !== undefined && typeof element.locked !== "boolean")) return "INVALID_WIDGET_ELEMENT_APPEARANCE";
    if (element.style !== undefined) {
      if (!isObject(element.style)) return "INVALID_WIDGET_ELEMENT_PROPERTIES";
      for (const [key, bounds] of Object.entries(STYLE_BOUNDS)) {
        if (element.style[key] !== undefined && badNumber(element.style[key], bounds)) return "INVALID_WIDGET_ELEMENT_STYLE";
      }
    }
    if (element.animation !== undefined) {
      if (!isObject(element.animation)) return "INVALID_WIDGET_ELEMENT_ANIMATION";
      if (element.animation.enabled !== undefined && typeof element.animation.enabled !== "boolean") return "INVALID_WIDGET_ELEMENT_ANIMATION";
      if (element.animation.durationMs !== undefined && badNumber(element.animation.durationMs, [100, 3000])) return "INVALID_WIDGET_ELEMENT_ANIMATION";
    }
  }
  return null;
}
