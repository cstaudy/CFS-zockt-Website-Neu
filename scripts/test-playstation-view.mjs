import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const publicJs = await readFile(new URL("../assets/js/cfs-home-playstation.js", import.meta.url), "utf8");
const privateJs = await readFile(new URL("../assets/js/playstation.js", import.meta.url), "utf8");
const privatePage = await readFile(new URL("../pages/playstation.html", import.meta.url), "utf8");
assert.match(privateJs, /fetch\("\/api\/creator\/playstation"/,
  "Creator workspace must request current account data");
assert.doesNotMatch(privateJs, /fetch\("\/api\/public\/playstation"/,
  "Creator workspace must not show the operator public feed");
for (const id of ["psnStatus", "psnLastSync", "psnActiveTitle",
  "psnActiveMeta", "psnRecentCount", "psnRecent", "psnPurchasedCount",
  "psnPurchased", "psnVideoCount", "psnVideos"]) {
  assert.match(privatePage, new RegExp('id="' + id + '"'), "Missing private UI node " + id);
}
function node(tagName = "div") {
  const classes = new Set();
  return {
    tagName, className: "", textContent: "", title: "", children: [],
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
      contains: name => classes.has(name)
    },
    append(...parts) { this.children.push(...parts); },
    replaceChildren(...parts) { this.children = parts; }
  };
}
async function render(data, failed = false) {
  const ids = ["refPsStatus", "refPsRecent", "refPsCatalog", "refPsVideos"];
  const els = new Map(ids.map(id => [id, node()]));
  const fetch = async (path, options) => {
    assert.equal(path, "/api/public/playstation");
    assert.equal(options.credentials, "omit",
      "Public status must not attach the private account cookie");
    assert.equal(options.cache, "no-store");
    if (failed) throw new Error("Network unavailable");
    return { ok: true, json: async () => data };
  };
  const document = {
    readyState: "complete",
    getElementById: id => els.get(id) || null,
    createElement: tag => node(tag)
  };
  runInNewContext(publicJs, {
    document, fetch, URL, Intl, Date, AbortController,
    setTimeout: () => 1, clearTimeout: () => {}, setInterval: () => {},
    console: { error: () => {} }
  });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  return els;
}
const historical = {
  ok: true, connected: true, sync_state: "offline", online: false,
  last_synced_at: "2026-11-13T16:00:00Z",
  recent_games: [{ title: "Racing", platform: "PS5",
    last_played_at: "2026-11-12T19:00:00Z" }],
  game_catalog: [{ title: "Library", platform: "PS4", in_catalog: true }],
  videos: [{ title: "Safe video", url: "https://videos.example.com/watch" },
    { title: "Unsafe video", url: "javascript:alert(1)" }]
};
const offline = await render(historical);
assert.match(offline.get("refPsStatus").textContent, /LAUNCHER OFFLINE/);
assert.equal(offline.get("refPsStatus").classList.contains("connected"), false);
assert.equal(offline.get("refPsRecent").children.length, 1);
assert.equal(offline.get("refPsCatalog").children.length, 1);
assert.equal(offline.get("refPsVideos").children.length, 1,
  "Unsafe video links must not be displayed");
assert.equal(offline.get("refPsVideos").children[0].href,
  "https://videos.example.com/watch");
const current = await render({ ...historical, sync_state: "current", online: true });
assert.equal(current.get("refPsStatus").classList.contains("connected"), true);
const stale = await render({ ...historical, sync_state: "stale" });
assert.equal(stale.get("refPsStatus").textContent, "DATEN VERALTET");
const missing = await render({ ok: true, connected: false, sync_state: "unavailable" });
assert.equal(missing.get("refPsStatus").textContent, "NICHT SYNCHRONISIERT");
const unreachable = await render(null, true);
assert.equal(unreachable.get("refPsStatus").textContent, "DATEN NICHT ERREICHBAR");
assert.equal(unreachable.get("refPsRecent").children.length, 1);
console.log("PlayStation public view: stale/offline/current, safe links, and account-isolated private feed verified.");
