import assert from "node:assert/strict";
import { safePlayStationUrl, validatePlayStationSync as validate } from "../src/playstation-validation.js";

const valid = {
  profile: { platform: "PS5", display_name: "CFS" },
  games: [{ title: "Racing", platform: "PS5", cover_url: "https://cdn.example.com/cover.webp",
    last_played_at: "2026-11-13T10:00:00Z", in_catalog: true }],
  videos: [{ title: "Highlights", url: "https://videos.example.com/watch?v=1",
    thumbnail_url: "https://cdn.example.com/thumb.jpg", published_at: "2026-11-12T22:05:12Z" }]
};
assert.equal(validate(valid).error, undefined);
assert.equal(validate(valid).games[0].title, "Racing");
assert.equal(validate(valid).videos[0].url, valid.videos[0].url);
assert.equal(validate({}).hasVideos, false);
assert.equal(validate({ videos: [] }).hasVideos, true);
assert.equal(validate({ games: [] }).hasGames, true);
assert.equal(validate({ games: [{ title: "Once" }, { title: "Once", in_catalog: false }] }).games.length, 1);
assert.equal(validate({ videos: [{ title: "A", url: "https://example.com/a" },
  { title: "B", url: "https://example.com/a" }] }).videos[0].title, "B");
for (const input of ["http://example.com/watch", "https://localhost/watch",
  "https://127.0.0.1/watch", "https://example.local/watch", "javascript:alert(1)",
  "https://user:password@example.com/path", "https://example.com/a#secret",
  "https://example.com:3000/a", "https://localhost./private",
  "https://host.internal./private", "https://0x7f000001/internal",
  "https://[::ffff:127.0.0.1]/private", "/relative", "https://[::1]/"]) {
  assert.equal(safePlayStationUrl(input), null, `Unsafe public video URL: ${input}`);
}
for (const [input, error] of [
  [null, "INVALID_PLAYSTATION_SYNC"],
  [[], "INVALID_PLAYSTATION_SYNC"],
  [{ profile: [] }, "INVALID_PLAYSTATION_PROFILE"],
  [{ profile: { display_name: "x".repeat(121) } }, "INVALID_PLAYSTATION_PROFILE"],
  [{ games: {} }, "INVALID_PLAYSTATION_GAMES"],
  [{ videos: {} }, "INVALID_PLAYSTATION_VIDEOS"],
  [{ games: Array(501).fill({ title: "Test" }) }, "INVALID_PLAYSTATION_GAMES"],
  [{ videos: Array(101).fill({ title: "Test", url: "https://example.com/a" }) }, "INVALID_PLAYSTATION_VIDEOS"],
  [{ games: [null] }, "INVALID_PLAYSTATION_GAME"],
  [{ games: [{ title: "" }] }, "INVALID_PLAYSTATION_GAME"],
  [{ games: [{ title: "Test", in_catalog: "false" }] }, "INVALID_PLAYSTATION_GAME"],
  [{ games: [{ title: "Test", cover_url: "http://localhost/image" }] }, "INVALID_PLAYSTATION_GAME"],
  [{ games: [{ title: "Test", last_played_at: "2026-02-30T12:00:00Z" }] }, "INVALID_PLAYSTATION_GAME"],
  [{ games: [{ title: "Test", last_played_at: "yesterday" }] }, "INVALID_PLAYSTATION_GAME"],
  [{ videos: [null] }, "INVALID_PLAYSTATION_VIDEO"],
  [{ videos: [{ title: "Oops", url: "http://example.com" }] }, "INVALID_PLAYSTATION_VIDEO"],
  [{ videos: [{ title: "Oops", url: "https://example.com/watch", published_at: "bad-date" }] }, "INVALID_PLAYSTATION_VIDEO"],
  [{ videos: [{ title: "Oops", url: "https://example.com/watch", thumbnail_url: "https://127.0.0.1/a" }] }, "INVALID_PLAYSTATION_VIDEO"],
  [{ games: [{ title: "Test", last_played_at: "2026-11-13T25:00:00Z" }] }, "INVALID_PLAYSTATION_GAME"],
  [{ games: [{ title: "Test", last_played_at: "2026-11-13T00:00:00+25:00" }] }, "INVALID_PLAYSTATION_GAME"],
  [{ games: [{ title: "Test", last_played_at: "2026-11-13T00:00:00+00:60" }] }, "INVALID_PLAYSTATION_GAME"],
  [{ profile: { platform: "PS5" }, games: [], extra: "x".repeat(524288) }, "PLAYSTATION_SYNC_TOO_LARGE"]
]) {
  assert.equal(validate(input).error, error, JSON.stringify(input).slice(0, 160));
}
console.log("PlayStation sync validation passed: strict HTTPS URLs, ISO dates, deduplication and bounded input.");
