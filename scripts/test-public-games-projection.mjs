import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { publicGamesFromPlayStation } from "../src/public-games.js";

const game = {
  title: "Racing", platform: "PS5",
  cover_url: "https://cdn.example.com/racing.webp",
  last_played_at: "2026-11-12T12:00:00Z",
  in_catalog: true, id: "private-game-id", account_id: "private-account-id",
  minutes: 900, sessions: 23
};
const state = {
  connected: true, sync_state: "offline", profile: {
    updated_at: "2026-11-13T15:00:00Z", account_id: "hidden"
  },
  game_catalog: [game, {
    title: "Unplayed catalog entry", platform: "PS4", last_played_at: null,
    cover_url: "http://127.0.0.1/private"
  }],
  recent_games: [game, { title: "No date", platform: "PC" }]
};
const data = publicGamesFromPlayStation(state);
assert.equal(data.ok, true);
assert.equal(data.available, true);
assert.equal(data.source, "launcher_playstation");
assert.equal(data.sync_state, "offline");
assert.equal(data.stale, true);
assert.equal(data.active, null, "Recorded history is not proof of a live game");
assert.equal(data.last_synced_at, "2026-11-13T15:00:00.000Z");
assert.equal(data.recent.length, 1, "Only actually dated history may be recent");
assert.equal(data.recent[0].platform, "playstation_5");
assert.equal(data.games.length, 2, "Catalog entries must remain distinct from play history");
assert.equal(data.games[1].image_url, null, "Local images are not public URLs");
assert.equal(data.games[0].image_url, "https://cdn.example.com/racing.webp");
assert.equal(data.recent[0].minutes, undefined, "Never invent playtime");
assert.equal(data.recent[0].sessions, undefined, "Never invent session totals");
assert.equal(data.recent[0].id, undefined, "Never leak private row identifiers");
assert.equal(data.recent[0].account_id, undefined, "Never leak account identifiers");
assert.equal(JSON.stringify(data).includes("private"), false);

const disconnected = publicGamesFromPlayStation({
  ...state, connected: false, sync_state: "current"
});
assert.equal(disconnected.available, false);
assert.equal(disconnected.sync_state, "unavailable");
assert.deepEqual(disconnected.games, []);
assert.deepEqual(disconnected.recent, []);
assert.equal(disconnected.last_synced_at, null);

for (const url of [
  "http://example.com/a", "https://localhost/a", "https://127.0.0.1/a",
  "https://example.internal/a", "https://example.local/a",
  "https://user:pass@example.com/a", "https://example.com:1234/a",
  "https://example.com/a#secret", "javascript:alert(1)",
  "https://localhost./a", "https://server.internal./a",
  "https://[::ffff:127.0.0.1]/a", "https://0x7f000001/a",
  "/relative", "https://[::1]/"
]) {
  const value = publicGamesFromPlayStation({
    connected: true, game_catalog: [{ title: "Test", cover_url: url }]
  });
  assert.equal(value.games[0].image_url, null, "Reject unsafe cover URL: " + url);
}
assert.deepEqual(publicGamesFromPlayStation({}).games, []);
const server = await readFile(new URL("../server.js", import.meta.url), "utf8");
assert.match(server, /publicGamesFromPlayStation\(state\)/,
  "Public games must read the existing public PlayStation source");
console.log("Public gaming projection: verified history only, no live claim, no private IDs or unsafe image URLs.");
