import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { publicGamesFromPlayStation } from "../src/public-games.js";

const state = {
  connected: true, online: false, sync_state: "offline",
  last_synced_at: "2026-11-13T15:00:00.000Z",
  game_catalog: [
    { title: "Racing", platform: "PS5", cover_url: "https://cdn.example.com/racing.webp",
      last_played_at: "2026-11-12T12:00:00Z", in_catalog: true },
    { title: "Library only", platform: "PS4", last_played_at: null, in_catalog: true }
  ],
  recent_games: [{ title: "Racing", platform: "PS5", last_played_at: "2026-11-12T12:00:00Z" }],
  message: "Launcher offline"
};
const projected = publicGamesFromPlayStation(state);
assert.equal(projected.ok, true);
assert.equal(projected.source, "launcher_playstation");
assert.equal(projected.sync_state, "offline");
assert.equal(projected.stale, true);
assert.equal(projected.active, null, "Historical games cannot be misrepresented as currently active");
assert.equal(projected.recent[0].name, "Racing");
assert.equal(projected.recent[0].platform, "playstation_5");
assert.equal(projected.games.length, 2);
assert.equal(projected.games[1].name, "Library only");
assert.equal(projected.recent[0].minutes, undefined, "Playtime must not be invented");
assert.equal(projected.recent[0].sessions, undefined, "Session counts must not be invented");
assert.equal(JSON.stringify(projected).includes("account_id"), false);
assert.equal(JSON.stringify(projected).includes("private-"), false);
const missing = publicGamesFromPlayStation({
  connected: false, sync_state: "unavailable", recent_games: [], game_catalog: []
});
assert.equal(missing.available, false);
assert.deepEqual(missing.games, []);
assert.deepEqual(missing.recent, []);

const homeScript = await readFile(new URL("../assets/js/cfs-gaming-home-v112.js", import.meta.url), "utf8");
assert.match(homeScript, /fetch\("\/api\/public\/games"/,
  "The public homepage must fetch confirmed games from the actual public games endpoint");
assert.match(homeScript, /game\?\.minutes !== undefined && game\?\.minutes !== null/,
  "Unknown playtime must not be represented as a fabricated 0 minutes");
assert.match(homeScript, /game\?\.last_played_at && Number\.isFinite\(Date\.parse/,
  "The latest-played section must omit catalog titles with no play history");
assert.match(homeScript, /sync_state==="offline"/,
  "The public games section must report the launcher offline state");
const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
assert.match(server, /publicGamesFromPlayStation\(state\)/,
  "The public games endpoint must use the verified owner PlayStation projection");

const publicScript = await readFile(new URL("../assets/js/cfs-home-playstation.js", import.meta.url), "utf8");
function fakeNode(tagName = "div") {
  const names = new Set();
  return {
    tagName, textContent: "", title: "", children: [],
    classList: {
      add: value => names.add(value),
      remove: value => names.delete(value),
      toggle: (value, enabled) => enabled ? names.add(value) : names.delete(value),
      contains: value => names.has(value)
    },
    append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = items; }
  };
}
async function renderPublicPlayStation(payload, failed = false) {
  const nodes = new Map(["refPsStatus", "refPsRecent", "refPsCatalog", "refPsVideos"]
    .map(name => [name, fakeNode()]));
  const document = {
    readyState: "complete",
    getElementById: id => nodes.get(id) || null,
    createElement: tag => fakeNode(tag)
  };
  const fetch = async (url, options) => {
    assert.equal(url, "/api/public/playstation");
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    if (failed) throw new Error("offline");
    return { ok: true, json: async () => payload };
  };
  runInNewContext(publicScript, {
    document, fetch, URL, Date, Intl, AbortController,
    setTimeout: () => 1, clearTimeout: () => {},
    setInterval: () => 1, console: { error: () => {} }
  });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  return nodes;
}
const offline = await renderPublicPlayStation({
  ok: true, connected: true, online: false, sync_state: "offline",
  last_synced_at: "2026-11-13T15:00:00.000Z",
  recent_games: [{ title: "Racing", platform: "PS5", last_played_at: "2026-11-12T12:00:00Z" }],
  game_catalog: [{ title: "Library only", in_catalog: true }],
  videos: [{ title: "Safe Video", url: "https://videos.example.com/watch" },
    { title: "Unsafe", url: "javascript:alert(1)" }]
});
assert.match(offline.get("refPsStatus").textContent, /LAUNCHER OFFLINE/);
assert.equal(offline.get("refPsStatus").classList.contains("connected"), false);
assert.equal(offline.get("refPsRecent").children.length, 1);
assert.equal(offline.get("refPsCatalog").children.length, 1);
assert.equal(offline.get("refPsVideos").children.length, 1,
  "Unsafe video URLs cannot appear on the public homepage");
assert.equal(offline.get("refPsVideos").children[0].href, "https://videos.example.com/watch");
assert.match(offline.get("refPsCatalog").children[0].children.at(-1).children[1].textContent,
  /Kauf nicht bestätigt/);
const stale = await renderPublicPlayStation({
  ok: true, connected: true, online: false, sync_state: "stale", recent_games: [], game_catalog: [], videos: []
});
assert.equal(stale.get("refPsStatus").textContent, "DATEN VERALTET");
const unavailable = await renderPublicPlayStation({ ok: true, sync_state: "unavailable" });
assert.equal(unavailable.get("refPsStatus").textContent, "NICHT SYNCHRONISIERT");
const failed = await renderPublicPlayStation(null, true);
assert.equal(failed.get("refPsStatus").textContent, "DATEN NICHT ERREICHBAR");
assert.equal(failed.get("refPsRecent").children.length, 1);
console.log("Public gaming: confirmed history projection, no invented stats, safe links, offline and error states.");
