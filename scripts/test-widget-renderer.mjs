import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../assets/js/cfs-widget-renderer.js", import.meta.url), "utf8");
const context = { module: { exports: {} }, console, Date, Number, String, Math };
runInNewContext(source, context, { filename: "cfs-widget-renderer.js", timeout: 2000 });
const renderer = context.module.exports;

assert.equal(renderer.OUTPUT_PROFILES.obs.kind, "intrinsic");
assert.equal(renderer.OUTPUT_PROFILES.tiktok_vertical.width, 1080);
assert.equal(renderer.OUTPUT_PROFILES.tiktok_vertical.height, 1920);
assert.equal(renderer.OUTPUT_PROFILES.landscape.width, 1920);
assert.equal(renderer.OUTPUT_PROFILES.landscape.height, 1080);

const config = { canvas: { width: 620, height: 132 }, elements: [
  { id: "title", type: "text", position: { x: 0, y: 0 }, size: { width: 400, height: 50 }, data: { text: "<script>alert(1)</script>" } }
] };
const obs = renderer.profileScene(config, "obs");
assert.equal(obs.width, 620);
assert.equal(obs.height, 132);
assert.equal(obs.placement.scale, 1);
const vertical = renderer.profileScene(config, "tiktok_vertical");
assert.equal(vertical.width, 1080);
assert.equal(vertical.height, 1920);
assert.equal(vertical.safeArea, true);
assert.ok(vertical.placement.left >= 0);
assert.ok(vertical.placement.top >= 0);
const html = renderer.renderElements(config, { current: 0, goal: 10 });
assert.ok(html.includes("&lt;script&gt;"));
assert.ok(!html.includes("<script>"));
const fallback = renderer.profileScene(config, "not-a-profile");
assert.equal(fallback.profile, "obs");

const offline = renderer.runtimeData({
  definition: { source_kind: "live_bridge", mode: "goal", metric: "live.followers" },
  config: { settings: { offlineBehavior: "zero" } },
  data: { live: { connected: false, followers: 900 } }
});
assert.equal(offline.offline, true);
assert.equal(offline.current, 0);

console.log("Widget renderer smoke tests passed: OBS, vertical profile, fallback, escaping and offline behavior.");
