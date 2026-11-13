import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { projectPlayStationState, PLAYSTATION_FRESH_MS, LAUNCHER_ONLINE_MS } from "../src/playstation-state.js";

const now = Date.parse("2026-11-13T18:00:00.000Z");
const timestamp = difference => new Date(now - difference).toISOString();
const profile = { provider: "launcher", platform: "PS5", display_name: "CI Player",
  connected: true, updated_at: timestamp(60_000) };
const games = [
  { id: "private-1", title: "Older", platform: "PS5", in_catalog: true,
    last_played_at: timestamp(172_800_000), cover_url: "http://localhost/private" },
  { id: "private-2", title: "Newest", platform: "PS5", in_catalog: false,
    last_played_at: timestamp(3_600_000), cover_url: "https://cdn.example.org/game.jpg" },
  { id: "private-3", title: "Library", platform: "PS5", in_catalog: true,
    last_played_at: null }
];
const videos = [
  { id: "video-1", title: "Safe", url: "https://videos.example.org/watch?v=1",
    thumbnail_url: "https://cdn.example.org/a.png" },
  { id: "video-2", title: "Legacy unsafe", url: "http://127.0.0.1/internal" }
];
const current = projectPlayStationState({
  now, profile, games, videos, lastLauncherSeenAt: timestamp(30_000)
});
assert.equal(current.connected, true);
assert.equal(current.online, true);
assert.equal(current.launcher_online, true);
assert.equal(current.sync_state, "current");
assert.equal(current.active_game, null,
  "A previously played title must never be described as currently active");
assert.equal(current.last_synced_at, profile.updated_at);
assert.deepEqual(current.recent_games.map(game => game.title), ["Newest", "Older"]);
assert.deepEqual(current.game_catalog.map(game => game.title), ["Older", "Library"]);
assert.equal(current.game_catalog[0].cover_url, null, "Unsafe legacy cover links are stripped");
assert.equal(current.videos.length, 1, "Unsafe legacy video links are excluded");
assert.equal(current.videos[0].id, "video-1", "The private view keeps owner-only IDs");

const offline = projectPlayStationState({
  now, profile, games, lastLauncherSeenAt: timestamp(LAUNCHER_ONLINE_MS + 1)
});
assert.equal(offline.connected, true, "Connection history is not erased");
assert.equal(offline.launcher_online, false);
assert.equal(offline.online, false, "A disconnected launcher cannot be marked online");
assert.equal(offline.sync_state, "offline");
assert.match(offline.message, /offline/i);
assert.equal(offline.recent_games.length, 2, "Historical games remain explicitly visible");

const stale = projectPlayStationState({
  now, profile: { ...profile, updated_at: timestamp(PLAYSTATION_FRESH_MS + 1) },
  lastLauncherSeenAt: timestamp(0)
});
assert.equal(stale.sync_state, "stale");
assert.equal(stale.online, false);
assert.equal(stale.launcher_online, true, "Heartbeat state and sync freshness are distinct");
const future = projectPlayStationState({
  now, profile: { ...profile, updated_at: new Date(now + 61_000).toISOString() },
  lastLauncherSeenAt: timestamp(0)
});
assert.equal(future.sync_state, "stale", "Clock-skewed future timestamps cannot claim freshness");

const missing = projectPlayStationState({ now });
assert.equal(missing.sync_state, "unavailable");
assert.equal(missing.connected, false);
assert.equal(missing.online, false);
assert.equal(missing.recent_games.length, 0);

const publicView = projectPlayStationState({
  now, profile, games, videos, lastLauncherSeenAt: timestamp(0), publicView: true
});
assert.equal(publicView.game_catalog[0].id, undefined,
  "Public PlayStation data must not expose private project IDs");
assert.equal(publicView.videos[0].id, undefined);
assert.equal(publicView.game_catalog[0].source, undefined);

const browser = await readFile(new URL("../assets/js/playstation.js", import.meta.url), "utf8");
assert.match(browser, /fetch\("\/api\/creator\/playstation"/,
  "The account-specific Creator workspace must read its owner's private API");
assert.doesNotMatch(browser, /fetch\("\/api\/public\/playstation"/,
  "The personal workspace must never show the public admin PlayStation profile");
console.log("PlayStation presentation passed: private owner feed, honest activity, freshness, offline and stale states.");
