import assert from "node:assert/strict";
import { validateWidgetElementAttributes as validate } from "../src/widget-element-validation.js";

const valid = {
  type: "text", position: { x: -200, y: 30 }, size: { width: 600, height: 120 },
  rotation: -360, opacity: 0, zIndex: 1000, visible: false, locked: true,
  style: { fontSize: 200, fontWeight: 900, borderRadius: 999, shadowX: -80, glowBlur: 80 },
  animation: { enabled: true, enter: "fade", durationMs: 3000 }
};
assert.equal(validate([valid]), null);
assert.equal(validate([{ type: "shape" }]), null);
assert.equal(validate(undefined), null);

const cases = [
  [{ rotation: "45" }, "INVALID_WIDGET_ELEMENT_APPEARANCE"],
  [{ rotation: 361 }, "INVALID_WIDGET_ELEMENT_APPEARANCE"],
  [{ opacity: -0.1 }, "INVALID_WIDGET_ELEMENT_APPEARANCE"],
  [{ opacity: 1.01 }, "INVALID_WIDGET_ELEMENT_APPEARANCE"],
  [{ zIndex: Infinity }, "INVALID_WIDGET_ELEMENT_APPEARANCE"],
  [{ zIndex: -1001 }, "INVALID_WIDGET_ELEMENT_APPEARANCE"],
  [{ visible: "true" }, "INVALID_WIDGET_ELEMENT_APPEARANCE"],
  [{ locked: 1 }, "INVALID_WIDGET_ELEMENT_APPEARANCE"],
  [{ style: { fontSize: "20" } }, "INVALID_WIDGET_ELEMENT_STYLE"],
  [{ style: { fontSize: 7 } }, "INVALID_WIDGET_ELEMENT_STYLE"],
  [{ style: { fontWeight: 901 } }, "INVALID_WIDGET_ELEMENT_STYLE"],
  [{ style: { borderRadius: 1000 } }, "INVALID_WIDGET_ELEMENT_STYLE"],
  [{ style: { shadowX: -81 } }, "INVALID_WIDGET_ELEMENT_STYLE"],
  [{ style: { glowBlur: null } }, "INVALID_WIDGET_ELEMENT_STYLE"],
  [{ style: [] }, "INVALID_WIDGET_ELEMENT_PROPERTIES"],
  [{ animation: [] }, "INVALID_WIDGET_ELEMENT_ANIMATION"],
  [{ animation: null }, "INVALID_WIDGET_ELEMENT_ANIMATION"],
  [{ animation: { enabled: "yes" } }, "INVALID_WIDGET_ELEMENT_ANIMATION"],
  [{ animation: { durationMs: 99 } }, "INVALID_WIDGET_ELEMENT_ANIMATION"],
  [{ animation: { durationMs: 3001 } }, "INVALID_WIDGET_ELEMENT_ANIMATION"]
];
for (const [patch, expected] of cases) {
  assert.equal(validate([{ ...valid, ...patch }]), expected, JSON.stringify(patch));
}
console.log("Widget element validation passed: appearance, styles, animation and valid editor ranges.");
