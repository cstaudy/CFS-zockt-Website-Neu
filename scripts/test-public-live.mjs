import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const previousFetch = globalThis.fetch;
const previousClient = process.env.TWITCH_CLIENT_ID;
const previousSecret = process.env.TWITCH_CLIENT_SECRET;
let caseNumber = 0;
const user = { data: [{ id: "123", login: "cfs_zockt" }] };
const liveStream = { data: [{
  id: "stream-123", user_id: "123", type: "live",
  game_name: "Racing", title: "LIVE NOW",
  viewer_count: 26, started_at: "2026-11-13T15:00:00Z"
}] };

async function checkProvider({ profile = user, stream = liveStream, token = { access_token: "ci", expires_in: 600 }, followers = { total: 42 }, configured = true } = {}) {
  process.env.TWITCH_CLIENT_ID = configured ? "ci-twitch-client" : "";
  process.env.TWITCH_CLIENT_SECRET = configured ? "ci-twitch-secret" : "";
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    assert(options.signal, "Twitch API calls must have timeouts");
    if (String(url).includes("/oauth2/token")) return { ok: Boolean(token), json: async () => token };
    if (String(url).includes("/helix/users?")) return { ok: Boolean(profile), json: async () => profile };
    if (String(url).includes("/helix/streams?")) {
      if (stream === "network-error") throw new Error("provider disconnected");
      return { ok: Boolean(stream), json: async () => stream };
    }
    if (String(url).includes("/helix/channels/followers?")) return { ok: Boolean(followers), json: async () => followers };
    throw new Error("Unexpected Twitch URL: " + url);
  };
  try {
    const module = await import(new URL(`../src/public-twitch.js?live-ci=${++caseNumber}`, import.meta.url));
    return { live: await module.publicTwitchState(), community: await module.publicTwitchCommunity(), calls };
  } finally {
    globalThis.fetch = previousFetch;
    if (previousClient === undefined) delete process.env.TWITCH_CLIENT_ID;
    else process.env.TWITCH_CLIENT_ID = previousClient;
    if (previousSecret === undefined) delete process.env.TWITCH_CLIENT_SECRET;
    else process.env.TWITCH_CLIENT_SECRET = previousSecret;
  }
}
const unavailable = await checkProvider({ configured: false });
assert.equal(unavailable.live.status, "unknown");
assert.equal(unavailable.live.live, false);
assert.equal(unavailable.live.source, "fallback");
assert.equal(unavailable.live.viewer_count, null);
assert.deepEqual(unavailable.calls, [], "No remote requests without Twitch credentials");

const unreachable = await checkProvider({ stream: "network-error" });
assert.equal(unreachable.live.status, "unknown", "Twitch outages cannot be described as OFFLINE");
assert.equal(unreachable.live.live, false);
const malformed = await checkProvider({ stream: { data: {} } });
assert.equal(malformed.live.status, "unknown", "Malformed stream response is not proof of OFFLINE");
const missingToken = await checkProvider({ token: null });
assert.equal(missingToken.live.status, "unknown");
const noProfile = await checkProvider({ profile: null });
assert.equal(noProfile.live.status, "unknown");
const wrongBroadcaster = await checkProvider({ stream: { data: [{ ...liveStream.data[0], user_id: "999" }] } });
assert.equal(wrongBroadcaster.live.status, "unknown");
const wrongStreamType = await checkProvider({ stream: { data: [{ ...liveStream.data[0], type: "offline" }] } });
assert.equal(wrongStreamType.live.status, "unknown");

const offline = await checkProvider({ stream: { data: [] } });
assert.equal(offline.live.status, "offline", "Only an explicit Twitch empty stream list proves OFFLINE");
assert.equal(offline.live.source, "twitch");
assert.equal(offline.live.viewer_count, null);
const confirmed = await checkProvider();
assert.equal(confirmed.live.status, "live");
assert.equal(confirmed.live.live, true);
assert.equal(confirmed.live.viewer_count, 26);
assert.equal(confirmed.live.game, "Racing");
assert.equal(confirmed.live.started_at, "2026-11-13T15:00:00Z");
assert.equal(confirmed.community.twitch_followers, 42);

const homepage = await readFile(new URL("../assets/js/cfs-gaming-home-v112.js", import.meta.url), "utf8");
assert.doesNotMatch(homepage, /fetch\("\/api\/public\/creator-state"/,
  "The public homepage must no longer render a hardcoded unavailable creator-state endpoint");
assert.match(homepage, /fetch\("\/api\/public\/live-session"/,
  "The homepage must fetch the actual Twitch live feed");

function node() {
  const classes = new Set();
  return {
    textContent: "", href: "", children: [],
    classList: {
      add: value => classes.add(value), remove: value => classes.delete(value),
      toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value),
      contains: value => classes.has(value)
    },
    append(...parts) { this.children.push(...parts); },
    appendChild(part) { this.children.push(part); },
    replaceChildren(...parts) { this.children = parts; },
    removeAttribute() {}, getAttribute() { return null; }
  };
}
async function renderHomepageLive(payload, fail = false) {
  const ids = [
    "liveStatusBadge", "livePreviewBadge", "liveStatusText", "liveStatusGame",
    "livePreviewGame", "liveStatusMeta", "liveViewers", "liveLikes", "liveShares",
    "liveDuration", "livePreviewViewers", "twitchLiveIndicator", "twitchLastLive",
    "tiktokLiveIndicator", "tiktokLastLive", "twitchChannelButton", "tiktokChannelButton",
    "statTikTok", "statDiscord", "statDiscordOnline", "footerTikTokFollowers", "footerDiscordMembers"
  ];
  const elements = new Map(ids.map(id => [id, node()]));
  const document = {
    readyState: "complete",
    getElementById: id => elements.get(id) || null,
    querySelectorAll: () => [], querySelector: () => null,
    createElement: () => node()
  };
  const fetch = async url => {
    if (url === "/api/public/live-session") {
      if (fail) throw new Error("Twitch unreachable");
      return { ok: true, json: async () => payload };
    }
    if (url === "/api/public/community-stats") return {
      ok: true, json: async () => ({ ok: true, source: "fallback" })
    };
    if (url === "/api/public/games") return {
      ok: true, json: async () => ({ ok: true, source: "unavailable", games: [], recent: [] })
    };
    throw new Error("Unexpected homepage request: " + url);
  };
  runInNewContext(homepage, {
    document, fetch, Intl, Date, URL,
    window: { setInterval: () => 1 },
    console: { error: () => {} }
  });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  return elements;
}
const liveUI = await renderHomepageLive(confirmed.live);
assert.equal(liveUI.get("liveStatusBadge").textContent, "LIVE");
assert.equal(liveUI.get("twitchLiveIndicator").textContent, "LIVE");
assert.equal(liveUI.get("tiktokLiveIndicator").textContent, "STATUS OFFEN",
  "An active Twitch stream cannot be misrepresented as a confirmed TikTok stream");
assert.equal(liveUI.get("tiktokLastLive").textContent, "TikTok-LIVE-Status nicht verfügbar",
  "Twitch data alone cannot establish whether TikTok is connected");
assert.equal(liveUI.get("liveViewers").textContent, "26");
assert.equal(liveUI.get("liveLikes").textContent, "—");
assert.equal(liveUI.get("liveShares").textContent, "—");
assert.match(liveUI.get("liveStatusText").textContent, /Twitch.*live/);
assert.equal(liveUI.get("twitchChannelButton").href, "https://www.twitch.tv/cfs_zockt");

const offlineUI = await renderHomepageLive(offline.live);
assert.equal(offlineUI.get("liveStatusBadge").textContent, "OFFLINE");
assert.equal(offlineUI.get("twitchLiveIndicator").textContent, "OFFLINE");
assert.equal(offlineUI.get("liveViewers").textContent, "—");
assert.equal(offlineUI.get("liveLikes").textContent, "—");
assert.equal(offlineUI.get("tiktokLiveIndicator").textContent, "STATUS OFFEN");

const unknownUI = await renderHomepageLive(unreachable.live);
assert.equal(unknownUI.get("liveStatusBadge").textContent, "STATUS OFFEN");
assert.equal(unknownUI.get("twitchLiveIndicator").textContent, "STATUS OFFEN");
assert.equal(unknownUI.get("twitchLastLive").textContent, "Twitch-LIVE-Status nicht verfügbar",
  "An API outage must not be presented as a disconnected Twitch integration");
assert.equal(unknownUI.get("liveViewers").textContent, "—");
assert.match(unknownUI.get("liveStatusText").textContent, /nicht eindeutig/);
const failedUI = await renderHomepageLive(null, true);
assert.equal(failedUI.get("liveStatusBadge").textContent, "STATUS OFFEN",
  "A network error cannot be reported as either confirmed LIVE or OFFLINE");

console.log("Public live: confirmed Twitch status, unknown-provider failures, safe homepage metrics and TikTok signal isolation.");
