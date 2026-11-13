import assert from "node:assert/strict";
import { publicScenePayload } from "../src/scene-output.js";

const owner = "123e4567-e89b-42d3-a456-426614174111";
const sceneId = "123e4567-e89b-42d3-a456-426614174112";
const widgetId = "123e4567-e89b-42d3-a456-426614174113";
const config = {
  profile: "landscape", canvas: { width: 1920, height: 1080, background: "#101820" },
  items: [{ id: "published", widget_id: widgetId, x: 120, y: 140, scale: 1.5, opacity: 0.75, rotation: 10, z_index: 2 }]
};
const scene = { id: sceneId, account_id: owner, status: "published", data: {
  draft_config: { items: [{ id: "draft-only", widget_id: widgetId }] }, published_config: config
} };
const widget = { id: widgetId, account_id: owner, status: "published", data: {
  draft_config: { elements: [{ type: "text", data: { text: "SECRET DRAFT" } }] },
  published_config: { widgetType: "manual_counter", canvas: { width: 620, height: 132 }, elements: [{ type: "text", data: { text: "LIVE" } }] }
} };
const payload = publicScenePayload(scene, [widget]);
assert.equal(payload.scene.id, sceneId);
assert.equal(payload.scene.items.length, 1);
assert.equal(payload.scene.items[0].widget_id, widgetId);
assert.equal(payload.scene.items[0].width, 620);
assert.equal(payload.scene.items[0].height, 132);
assert.equal(payload.scene.items[0].x, 120);
assert.equal(payload.scene.canvas.background, "#101820");
assert.ok(!JSON.stringify(payload).includes("SECRET"));
assert.ok(!JSON.stringify(payload).includes("draft-only"));

// No other creator's widget may be embedded through a scene.
assert.equal(publicScenePayload(scene, [{ ...widget, account_id: "123e4567-e89b-42d3-a456-426614174199" }]), null);
assert.equal(publicScenePayload(scene, [{ ...widget, status: "draft" }]), null);
assert.equal(publicScenePayload(scene, [{ ...widget, data: { draft_config: { elements: [] } } }]), null);
assert.equal(publicScenePayload({ ...scene, status: "draft" }, [widget]), null);
assert.equal(publicScenePayload({ ...scene, data: { draft_config: config } }, [widget]), null);
assert.equal(publicScenePayload({ ...scene, data: { published_config: { ...config, items: [] } } }, [widget]), null);
const unsafe = publicScenePayload({ ...scene, data: { published_config: { ...config, canvas: { background: "url(https://unsafe.example/a)" }, items: [{ widget_id: widgetId, x: 999999, scale: Infinity }] } } }, [widget]);
assert.equal(unsafe.scene.canvas.background, "transparent");
assert.equal(unsafe.scene.items[0].x, 4000);
assert.equal(unsafe.scene.items[0].scale, 1);
console.log("Published scene projection tests passed: owner isolation, draft protection, safe placement.");
