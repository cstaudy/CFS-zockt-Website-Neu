import assert from "node:assert/strict";
import { validateSceneConfig as validate } from "../src/scene-validation.js";

const widget = "123e4567-e89b-42d3-a456-426614174000";
const valid = {
  profile: "landscape",
  canvas: { width: 1920, height: 1080, background: "transparent" },
  items: [{ id: "widget_board_1", widget_id: widget, visible: true,
    x: -4000, y: 4000, scale: 0.1, opacity: 0, rotation: -360, z_index: 1000, locked: false }]
};
assert.equal(validate(valid, { publish: true }), null);
assert.equal(validate({}), null, "Empty drafts may be saved");
assert.equal(validate({}), null);
assert.equal(validate({}, { publish: true }), "INVALID_SCENE_ITEMS");
assert.equal(validate({ items: [] }, { publish: true }), "SCENE_HAS_NO_VISIBLE_WIDGETS");
assert.equal(validate({ items: [{ widget_id: widget, visible: false }] }, { publish: true }), "SCENE_HAS_NO_VISIBLE_WIDGETS");
assert.equal(validate({ ...valid, items: [{ widget_id: widget }] }, { publish: true }), null);
const cases = [
  [null, "INVALID_SCENE_CONFIG"],
  [[], "INVALID_SCENE_CONFIG"],
  [{ profile: "unknown" }, "INVALID_SCENE_PROFILE"],
  [{ canvas: [] }, "INVALID_SCENE_CANVAS"],
  [{ canvas: { width: 0 } }, "INVALID_SCENE_CANVAS"],
  [{ canvas: { height: "1080" } }, "INVALID_SCENE_CANVAS"],
  [{ canvas: { background: "url(https://example.test/image)" } }, "INVALID_SCENE_CANVAS"],
  [{ items: null }, "INVALID_SCENE_ITEMS"],
  [{ items: Array.from({ length: 101 }, () => valid.items[0]) }, "INVALID_SCENE_ITEMS"],
  [{ items: [null] }, "INVALID_SCENE_WIDGET"],
  [{ items: [{ widget_id: "not-a-uuid" }] }, "INVALID_SCENE_WIDGET"],
  [{ items: [{ widget_id: widget, x: 4001 }] }, "INVALID_SCENE_ITEM_GEOMETRY"],
  [{ items: [{ widget_id: widget, y: NaN }] }, "INVALID_SCENE_ITEM_GEOMETRY"],
  [{ items: [{ widget_id: widget, scale: 0 }] }, "INVALID_SCENE_ITEM_GEOMETRY"],
  [{ items: [{ widget_id: widget, opacity: 1.1 }] }, "INVALID_SCENE_ITEM_GEOMETRY"],
  [{ items: [{ widget_id: widget, rotation: -361 }] }, "INVALID_SCENE_ITEM_GEOMETRY"],
  [{ items: [{ widget_id: widget, z_index: "2" }] }, "INVALID_SCENE_ITEM_GEOMETRY"],
  [{ items: [{ widget_id: widget, locked: "false" }] }, "INVALID_SCENE_ITEM_PROPERTIES"],
  [{ items: [{ widget_id: widget, visible: "true" }] }, "INVALID_SCENE_ITEM_PROPERTIES"],
  [{ items: [{ id: "<script>", widget_id: widget }] }, "INVALID_SCENE_ITEM_ID"],
  [{ items: [{ id: "duplicate", widget_id: widget }, { id: "duplicate", widget_id: widget }] }, "INVALID_SCENE_ITEM_ID"]
];
for (const [input, expected] of cases) {
  assert.equal(validate(input), expected, JSON.stringify(input));
}
console.log("Scene validation passed: safe geometry, unique IDs, drafts and publishable layouts.");
