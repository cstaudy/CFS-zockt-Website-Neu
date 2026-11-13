import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const output = await readFile(new URL("../assets/js/stream-maker-output.js", import.meta.url), "utf8");
const html = await readFile(new URL("../widgets/stream-maker.html", import.meta.url), "utf8");
assert.match(html, /stream-maker-output\.js/);
assert.match(html, /stream-maker-output\.css/);

const token = "123e4567-e89b-42d3-a456-426614174001" + "a".repeat(43);
const source = "/api/public/stream-maker/" + token;
const bundle = { config: { name: "Approved OBS Source",
  source: "", elements: [{ id: "ci_counter", template: "counter", width: 800, height: 320, value: 8 }] } };

async function runScenario(responses) {
  const canvas = {
    width: 1, height: 1,
    getContext() { return { clearRect() {} }; }
  };
  const error = { textContent: "", hidden: true };
  const urls = [], intervals = new Map();
  let draws = 0;
  const renderer = {
    sanitize: config => config,
    source: config => config.source || "",
    render: (node, config, element) => {
      draws++;
      node.width = element.width;
      node.height = element.height;
    }
  };
  const context = {
    URLSearchParams, URL, AbortController,
    location: { search: "?token=" + token + "&element=ci_counter", origin: "http://localhost" },
    document: { getElementById(name) { return name === "output" ? canvas : name === "error" ? error : null; } },
    StreamMaker: renderer,
    console: { error() {} },
    setInterval: (fn, ms) => { intervals.set(ms, fn); return ms; },
    setTimeout: () => 1, clearTimeout() {},
    fetch: async (url, options) => {
      urls.push({ url, options });
      const next = responses.shift();
      assert.ok(next, "Expected a mocked public response");
      return { ok: next.status === 200, status: next.status, json: async () => next.payload };
    }
  };
  runInNewContext(output, context);
  const flush = async () => {
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
  };
  await flush();
  return { canvas, error, urls, intervals, flush, drawCount: () => draws };
}
const revoked = await runScenario([
  { status: 200, payload: bundle },
  { status: 404, payload: { error: "STREAM_MAKER_NOT_FOUND" } }
]);
assert.equal(revoked.urls[0].url, source);
assert.equal(revoked.urls[0].options.credentials, "omit");
assert.equal(revoked.urls[0].options.cache, "no-store");
assert.equal(revoked.canvas.width, 800);
assert.equal(revoked.error.hidden, true);
assert.ok(revoked.drawCount() >= 1);
const oldDraws = revoked.drawCount();
revoked.intervals.get(30000)();
await revoked.flush();
assert.equal(revoked.canvas.width, 1, "Revoked OBS canvas must be cleared immediately");
assert.equal(revoked.error.hidden, false);
revoked.intervals.get(1000)();
assert.equal(revoked.drawCount(), oldDraws,
  "Render timer must not redraw revoked content after token rotation or archive");

const removed = await runScenario([
  { status: 200, payload: bundle },
  { status: 200, payload: {
    config: { ...bundle.config, elements: [{ id: "other", template: "counter", width: 800, height: 320 }] }
  } }
]);
const drawnBeforeRemoval = removed.drawCount();
removed.intervals.get(30000)();
await removed.flush();
assert.equal(removed.canvas.width, 1, "Removed widget element must clear last published frame");
removed.intervals.get(1000)();
assert.equal(removed.drawCount(), drawnBeforeRemoval,
  "A removed element must never be redrawn by the stale renderer");
console.log("Signed Stream Maker OBS output: cookie-free token fetch, no-store, instant revocation and missing element clearing.");
