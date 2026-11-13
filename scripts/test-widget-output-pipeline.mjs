import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { publicWidgetPayload } from "../src/widget-output.js";

const rendererSource = await readFile(new URL("../assets/js/cfs-widget-renderer.js", import.meta.url), "utf8");
const runtimeSource = await readFile(new URL("../assets/js/cfs-widget-runtime.js", import.meta.url), "utf8");
const rendererContext = { module: { exports: {} }, console, Date, Number, String, Math };
runInNewContext(rendererSource, rendererContext);
const renderer = rendererContext.module.exports;

const row = {
  id: "123e4567-e89b-42d3-a456-426614174000", status: "published",
  data: { draft_config: { elements: [{ id: "draft", type: "text" }] },
    published_config: { widgetType: "manual_counter", canvas: { width: 620, height: 132 },
      settings: { manualValue: 42, goal: 100 },
      elements: [{ id: "live", type: "counter", position: { x: 0, y: 0 },
        size: { width: 300, height: 50 }, data: { format: "{{current}}" } }] } }
};
const payload = publicWidgetPayload(row);
assert.equal(renderer.runtimeData(payload).current, 42);
assert.ok(renderer.renderElements(payload.widget.config, renderer.runtimeData(payload)).includes("42"));
assert.ok(!JSON.stringify(payload).includes("draft"));

const stage = { style: {}, dataset: {}, innerHTML: "", replaceChildren() { this.innerHTML = ""; } };
const scene = { style: {}, dataset: {} };
const requested = [];
let ticks;
const context = {
  console, URLSearchParams, location: { search: "?widget=" + row.id + "&profile=tiktok_vertical" },
  document: { getElementById(id) { return id === "cfsScene" ? scene : id === "cfsWidgetStage" ? stage : null; } },
  CFSWidgetRenderer: renderer,
  fetch: async (url, options) => {
    requested.push({ url, options });
    return { ok: true, json: async () => payload };
  },
  setInterval(fn, ms) { ticks = { fn, ms }; },
};
runInNewContext(runtimeSource, context);
await new Promise(resolve => setImmediate(resolve));
assert.equal(requested[0].url, "/api/public/widgets/" + row.id);
assert.equal(requested[0].options.credentials, "omit");
assert.equal(scene.dataset.profile, "tiktok_vertical");
assert.ok(stage.innerHTML.includes("42"));
assert.equal(ticks.ms, 15000);
await ticks.fn();
assert.equal(requested.length, 2);

// A missing/unpublished widget must clear the frame and stop polling.
let notFoundCalls = 0;
const missingStage = { style: {}, dataset: {}, innerHTML: "stale", replaceChildren() { this.innerHTML = ""; } };
let missingTick;
const missingContext = {
  console: { error() {} }, URLSearchParams,
  location: { search: "?widget=" + row.id },
  document: { getElementById(id) { return id === "cfsScene" ? { style: {}, dataset: {} } : id === "cfsWidgetStage" ? missingStage : null; } },
  CFSWidgetRenderer: renderer,
  fetch: async () => { notFoundCalls++; return { ok: false, status: 404 }; },
  setInterval(fn) { missingTick = fn; }
};
runInNewContext(runtimeSource, missingContext);
await new Promise(resolve => setImmediate(resolve));
assert.equal(missingStage.innerHTML, "");
await missingTick();
assert.equal(notFoundCalls, 1);
// Revoked and permanently removed widgets must clear previously rendered frames.
for (const status of [403, 410]) {
  let calls = 0;
  const revokedStage = { style: {}, dataset: {}, innerHTML: "previously-published", replaceChildren() { this.innerHTML = ""; } };
  let nextTick;
  runInNewContext(runtimeSource, {
    console: { error() {} }, URLSearchParams,
    location: { search: "?widget=" + row.id },
    document: { getElementById(id) { return id === "cfsScene" ? { style: {}, dataset: {} } : id === "cfsWidgetStage" ? revokedStage : null; } },
    CFSWidgetRenderer: renderer,
    fetch: async () => { calls++; return { ok: false, status }; },
    setInterval(fn) { nextTick = fn; }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(revokedStage.innerHTML, "");
  await nextTick();
  assert.equal(calls, 1);
}
console.log("OBS output pipeline tests passed: published projection, manual value, vertical browser render and polling.");
