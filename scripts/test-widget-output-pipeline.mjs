import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { publicWidgetPayload, applyTwitchWidgetState } from "../src/widget-output.js";

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
  console, URLSearchParams, AbortController, setTimeout, clearTimeout, location: { search: "?widget=" + row.id + "&profile=tiktok_vertical" },
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
  console: { error() {} }, URLSearchParams, AbortController, setTimeout, clearTimeout,
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
    console: { error() {} }, URLSearchParams, AbortController, setTimeout, clearTimeout,
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
// Short outages preserve the frame; sustained outages clear it and recovery renders again.
let offline = true;
let outageTick;
const outageStage = { style: {}, dataset: {}, innerHTML: "last-known-frame", replaceChildren() { this.innerHTML = ""; } };
const outageScene = { style: {}, dataset: {} };
runInNewContext(runtimeSource, {
  console: { error() {} }, URLSearchParams, AbortController, setTimeout, clearTimeout,
  location: { search: "?widget=" + row.id },
  document: { getElementById(id) { return id === "cfsScene" ? outageScene : id === "cfsWidgetStage" ? outageStage : null; } },
  CFSWidgetRenderer: renderer,
  fetch: async () => offline ? { ok: false, status: 503 } : { ok: true, json: async () => payload },
  setInterval(fn) { outageTick = fn; }
});
await new Promise(resolve => setImmediate(resolve));
assert.equal(outageStage.innerHTML, "last-known-frame");
await outageTick();
await outageTick();
assert.equal(outageStage.innerHTML, "last-known-frame");
await outageTick();
assert.equal(outageStage.innerHTML, "");
offline = false;
await outageTick();
assert.ok(outageStage.innerHTML.includes("42"));
// A hung request must be aborted, freeing the polling loop for a later retry.
let timeoutCallback;
let aborts = 0;
let hungCalls = 0;
let hungTick;
const timeoutStage = { style: {}, dataset: {}, innerHTML: "last-known-frame", replaceChildren() { this.innerHTML = ""; } };
runInNewContext(runtimeSource, {
  console: { error() {} }, URLSearchParams, AbortController,
  location: { search: "?widget=" + row.id },
  document: { getElementById(id) { return id === "cfsScene" ? { style: {}, dataset: {} } : id === "cfsWidgetStage" ? timeoutStage : null; } },
  CFSWidgetRenderer: renderer,
  fetch: async (_url, options) => {
    hungCalls++;
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => { aborts++; reject(new Error("aborted")); }, { once: true });
    });
  },
  setTimeout(fn, ms) { assert.equal(ms, 10000); timeoutCallback = fn; return 1; },
  clearTimeout() {},
  setInterval(fn) { hungTick = fn; }
});
timeoutCallback();
await new Promise(resolve => setImmediate(resolve));
assert.equal(aborts, 1);
assert.equal(timeoutStage.innerHTML, "last-known-frame");
const retry = hungTick();
assert.equal(hungCalls, 2);
timeoutCallback();
await retry;
assert.equal(aborts, 2);
// A mismatched or malformed API response must never overwrite the last valid OBS frame.
for (const invalidPayload of [
  { widget: { ...payload.widget, id: "123e4567-e89b-42d3-a456-426614174001" }, data: payload.data },
  { widget: { id: row.id, config: null }, data: payload.data },
  null
]) {
  let poll;
  const guardedStage = { style: {}, dataset: {}, innerHTML: "previous-frame", replaceChildren() { this.innerHTML = ""; } };
  runInNewContext(runtimeSource, {
    console: { error() {} }, URLSearchParams, AbortController, setTimeout, clearTimeout,
    location: { search: "?widget=" + row.id },
    document: { getElementById(id) { return id === "cfsScene" ? { style: {}, dataset: {} } : id === "cfsWidgetStage" ? guardedStage : null; } },
    CFSWidgetRenderer: renderer,
    fetch: async () => ({ ok: true, json: async () => invalidPayload }),
    setInterval(fn) { poll = fn; }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(guardedStage.innerHTML, "previous-frame");
  await poll();
  assert.equal(guardedStage.innerHTML, "previous-frame");
}
// Invalid identifiers must be rejected before any public API request.
let invalidCalls = 0;
runInNewContext(runtimeSource, {
  console: { error() {} }, URLSearchParams, AbortController, setTimeout, clearTimeout,
  location: { search: "?widget=------------------------------------" },
  document: { getElementById(id) { return id === "cfsScene" ? { style: {}, dataset: {} } : id === "cfsWidgetStage" ? { style: {}, dataset: {} } : null; } },
  CFSWidgetRenderer: renderer,
  fetch: async () => { invalidCalls++; },
  setInterval() {}
});
assert.equal(invalidCalls, 0);

const timerRow = {
  ...row,
  data: { published_config: {
    widgetType: "twitch_live_timer",
    canvas: { width: 620, height: 132 }, settings: { offlineBehavior: "zero" },
    elements: [{ id: "timer", type: "counter", data: { format: "{{timer}}" } }]
  } }
};
const timerBase = publicWidgetPayload(timerRow);
const startedAt = new Date(Date.now() - 121000).toISOString();
let timerResponse = applyTwitchWidgetState(timerBase, { status: "live", started_at: startedAt });
const timerNode = {
  textContent: "",
  getAttribute(name) { return name === "data-element" ? "timer" : null; }
};
const timerStage = {
  style: {}, dataset: {}, innerHTML: "",
  replaceChildren() { this.innerHTML = ""; },
  querySelectorAll(selector) {
    assert.equal(selector, "[data-element]");
    return [timerNode];
  }
};
const timerIntervals = new Map();
const timerIntervalCalls = new Map();
runInNewContext(runtimeSource, {
  console: { error() {} }, URLSearchParams, AbortController, setTimeout, clearTimeout,
  location: { search: "?widget=" + row.id },
  document: { getElementById(id) { return id === "cfsScene" ? { style: {}, dataset: {} } :
    id === "cfsWidgetStage" ? timerStage : null; } },
  CFSWidgetRenderer: renderer,
  fetch: async () => ({ ok: true, json: async () => timerResponse }),
  setInterval(fn, ms) {
    timerIntervals.set(ms, fn);
    timerIntervalCalls.set(ms, (timerIntervalCalls.get(ms) || 0) + 1);
  }
});
await new Promise(resolve => setImmediate(resolve));
assert.match(timerStage.innerHTML, /02:0[0-9]/,
  "Twitch OBS timer uses the confirmed provider start time");
assert.equal(typeof timerIntervals.get(1000), "function",
  "Verified live timers should tick smoothly between API polls");
assert.equal(typeof timerIntervals.get(15000), "function",
  "Source data should still be refreshed independently every 15 seconds");
timerIntervals.get(1000)();
assert.match(timerNode.textContent, /02:0[0-9]/,
  "Timer text may update locally without rebuilding the scene");
timerResponse = applyTwitchWidgetState(timerBase, { status: "offline" });
await timerIntervals.get(15000)();
timerNode.textContent = "frozen";
timerIntervals.get(1000)();
assert.equal(timerNode.textContent, "frozen",
  "An offline timer must never continue increasing from a stale start time");
timerResponse = applyTwitchWidgetState(timerBase, { status: "live", started_at: startedAt });
await timerIntervals.get(15000)();
assert.equal(timerIntervalCalls.get(1000), 1,
  "Recovering a Twitch connection must not spawn duplicate timer tickers");

console.log("OBS output pipeline tests passed: published projection, manual value, vertical browser render and polling.");
