import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { publicWidgetPayload } from "../src/widget-output.js";

const id = "123e4567-e89b-42d3-a456-426614174000";
const published = {
  id, account_id: "private-account", status: "published",
  data: {
    draft_config: { widgetType: "manual_counter", elements: [
      { type: "text", data: { text: "PRIVATE EDIT" } }
    ] },
    published_config: {
      widgetType: "manual_counter", canvas: { width: 620, height: 132 },
      settings: { manualValue: 42, goal: 100, apiToken: "PRIVATE TOKEN" },
      elements: [{ id: "counter", type: "counter", position: { x: 0, y: 0 },
        size: { width: 300, height: 50 }, data: { format: "{{current}}" } }]
    }
  }
};
assert.equal(publicWidgetPayload({ ...published, status: "draft" }), null);
assert.equal(publicWidgetPayload({ ...published, data: {
  draft_config: published.data.draft_config
} }), null, "A private draft without an approved snapshot must be inaccessible");
const payload = publicWidgetPayload(published);
assert.ok(payload);
assert.equal(payload.widget.id, id);
assert.equal(payload.widget.definition.mode, "manual_counter");
assert.equal(payload.widget.config.settings.manualValue, 42);
assert.equal(payload.widget.config.settings.apiToken, undefined);
assert.equal(payload.widget.config.elements.length, 1);
assert.equal(payload.widget.config.elements[0].type, "counter");
assert.equal(JSON.stringify(payload).includes("PRIVATE"), false);
assert.equal(JSON.stringify(payload).includes("account_id"), false);
assert.equal(publicWidgetPayload({ ...published, data: {
  published_config: { ...published.data.published_config, widgetType: "twitch_live_timer" }
} }), null, "Twitch requires separate provider acceptance");
assert.equal(publicWidgetPayload({ ...published, data: {
  published_config: { ...published.data.published_config, widgetType: "follower_goal" }
} }), null, "Unverified follower feeds may not be published");
const legacy = publicWidgetPayload({ ...published, data: {
  config: published.data.published_config
} });
assert.ok(legacy, "Explicitly published legacy manual widgets remain supported");
const malicious = publicWidgetPayload({ ...published, data: {
  published_config: {
    widgetType: "obs_overlay",
    canvas: { width: 99999, background: "url(https://evil.invalid)" },
    settings: { apiToken: "PRIVATE" },
    elements: [
      { type: "image", data: { src: "https://evil.invalid/spy.png" } },
      { type: "text", data: { text: "<script>alert(1)</script>", apiToken: "PRIVATE" },
        style: { color: "red;position:fixed", backgroundColor: "url(https://evil.invalid)" } }
    ]
  }
} });
assert.equal(malicious.widget.config.elements.length, 1);
assert.equal(malicious.widget.config.elements[0].type, "text");
assert.equal(malicious.widget.config.elements[0].style.color, "transparent");
assert.equal(malicious.widget.config.canvas.width, 4000);
assert.equal(JSON.stringify(malicious).includes("evil.invalid"), false);
assert.equal(JSON.stringify(malicious).includes("PRIVATE"), false);

const rendererSource = await readFile(new URL("../assets/js/cfs-widget-renderer.js", import.meta.url), "utf8");
const runtimeSource = await readFile(new URL("../assets/js/cfs-widget-runtime.js", import.meta.url), "utf8");
const html = await readFile(new URL("../widgets/output.html", import.meta.url), "utf8");
assert.match(html, /cfs-widget-runtime\.js/);
assert.match(html, /widget-runtime\.css/);
const rendererContext = { module: { exports: {} }, console, Date, Number, String, Math };
runInNewContext(rendererSource, rendererContext);
const renderer = rendererContext.module.exports;
assert.equal(renderer.runtimeData(payload).current, 42);
assert.ok(renderer.renderElements(payload.widget.config, renderer.runtimeData(payload)).includes("42"));
assert.ok(renderer.renderElements(malicious.widget.config, {}, {}).includes("&lt;script&gt;"));

async function runRuntime(result, status = 200) {
  const stage = {
    style: {}, dataset: {}, innerHTML: "OLD FRAME",
    replaceChildren() { this.innerHTML = ""; }
  };
  const scene = { style: {}, dataset: {} };
  const calls = [];
  const context = {
    console: { error() {} },
    URLSearchParams, Date, AbortController, setTimeout, clearTimeout,
    location: { search: "?widget=" + id + "&profile=obs" },
    document: { getElementById(name) {
      return name === "cfsScene" ? scene : name === "cfsWidgetStage" ? stage : null;
    } },
    CFSWidgetRenderer: renderer,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: status === 200, status, json: async () => result };
    },
    setInterval: () => 1
  };
  runInNewContext(runtimeSource, context);
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/public/widgets/" + id);
  assert.equal(calls[0].options.credentials, "omit");
  assert.equal(calls[0].options.cache, "no-store");
  return { stage, scene };
}
const visible = await runRuntime(payload);
assert.match(visible.stage.innerHTML, /42/);
assert.equal(visible.scene.dataset.profile, "obs");
const revoked = await runRuntime(null, 404);
assert.equal(revoked.stage.innerHTML, "",
  "Deleted or unpublished widgets must clear previously visible OBS output");
console.log("OBS manual/static output: public allowlist, draft privacy, safe renderer, no Twitch fallback, revocation.");
