import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const script = await readFile(new URL("../assets/js/cfs-gaming-home-v112.js", import.meta.url), "utf8");
function node(tagName = "div") {
  const classes = new Set();
  return {
    tagName, textContent: "", children: [], dataset: {}, hidden: false, open: false,
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
      contains: name => classes.has(name)
    },
    append(...parts) { this.children.push(...parts); },
    appendChild(value) { this.children.push(value); },
    replaceChildren(...parts) { this.children = parts; },
    setAttribute(key, value) { this[key] = value; },
    getAttribute(key) { return this[key] ?? null; },
    addEventListener() {}, removeEventListener() {}, remove() {}
  };
}
function allText(item) {
  if (typeof item === "string") return item;
  return [item?.textContent || "", ...(item?.children || []).map(allText)].join(" ");
}
async function render(games, fail = false) {
  const ids = ["recentGamesGrid", "recentGamesMeta", "recentGamesCount", "r107MoreGames",
    "r107OtherGamesGrid", "r107MoreCount", "r107GamesNote", "statGameTime",
    "statLatestGame", "statGameTimeLabel", "statLatestGameLabel", "footerRecentGames"];
  const nodes = new Map(ids.map(id => [id, node()]));
  const paths = [];
  const document = {
    readyState: "complete",
    getElementById: id => nodes.get(id) || null,
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: tag => node(tag)
  };
  const fetch = async (path, options) => {
    paths.push(path);
    assert.equal(options.cache, "no-store");
    if (path === "/api/public/creator-state") return {
      ok: true, json: async () => ({
        ok: true, creator: {}, game: {}, social: {}, live: { active: false, status: "unknown" }
      })
    };
    assert.equal(path, "/api/public/games");
    if (fail) throw new Error("offline");
    return { ok: true, json: async () => games };
  };
  runInNewContext(script, {
    document, fetch, Date, Intl, URL,
    window: { setInterval: () => 1 },
    console: { error: () => {} }
  });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(paths, ["/api/public/creator-state", "/api/public/games"]);
  return nodes;
}

const games = {
  ok: true, available: true, source: "launcher_playstation",
  sync_state: "offline", stale: true, active: null,
  recent: [{ name: "Racing", platform: "playstation_5",
    last_played_at: "2026-11-12T12:00:00.000Z", image_url: null }],
  games: [
    { name: "Racing", platform: "playstation_5",
      last_played_at: "2026-11-12T12:00:00.000Z", image_url: null },
    { name: "Library Only", platform: "playstation_4", last_played_at: null, image_url: null }
  ]
};
const result = await render(games);
const grid = result.get("recentGamesGrid");
assert.equal(grid.children.length, 1, "Undated library titles must not appear as recently played");
assert.match(allText(grid.children[0]), /Racing/);
assert.doesNotMatch(allText(grid.children[0]), /0 min|0 Session|0 Start/i,
  "No fabricated playtime or session totals");
assert.equal(result.get("r107OtherGamesGrid").children.length, 1,
  "Undated titles remain visible as catalog history");
assert.match(allText(result.get("r107OtherGamesGrid")), /kein Spielzeitpunkt bekannt/);
assert.equal(result.get("statGameTime").textContent, "—");
assert.equal(result.get("statGameTimeLabel").textContent, "Spielzeit nicht erfasst");
assert.equal(result.get("statLatestGame").textContent, "Racing");
assert.match(result.get("recentGamesMeta").textContent, /Launcher offline/);
assert.match(result.get("recentGamesCount").textContent, /2 Spiele/);
const empty = await render({ ok: true, source: "unavailable", games: [], recent: [] });
assert.match(allText(empty.get("recentGamesGrid")), /keine bestätigten Spiele/i);
assert.equal(empty.get("statLatestGame").textContent, "—");
const failed = await render(null, true);
assert.match(allText(failed.get("recentGamesGrid")), /nicht erreichbar/i);
console.log("Public game homepage: real feed, historical vs catalog separation, honest unknown stats and offline fallback.");
