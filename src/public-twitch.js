// Only confirmed Twitch API results can establish LIVE or OFFLINE.
// Missing credentials, provider outages and malformed replies remain unknown.
let tokenCache = { token: "", expiresAt: 0 };
const CHANNEL_LOGIN = /^[a-z0-9_]{3,25}$/i;
const TIMEOUT_MS = 6000;

async function providerJson(url, options = {}) {
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
async function appToken() {
  if (tokenCache.token && tokenCache.expiresAt > Date.now() + 30000) return tokenCache.token;
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) return "";
  const data = await providerJson("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials"
    })
  });
  const token = typeof data?.access_token === "string" ? data.access_token : "";
  if (!token) return "";
  const lifespan = Number(data.expires_in);
  tokenCache = {
    token,
    expiresAt: Date.now() + (Number.isFinite(lifespan) && lifespan > 0 ? lifespan : 300) * 1000
  };
  return token;
}
async function queryTwitch(path) {
  const token = await appToken();
  if (!token) return null;
  return providerJson(`https://api.twitch.tv/helix/${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Client-Id": process.env.TWITCH_CLIENT_ID }
  });
}
function configuredLogin() {
  const login = String(process.env.TWITCH_CHANNEL_LOGIN || "cfs_zockt").trim().toLowerCase();
  return CHANNEL_LOGIN.test(login) ? login : "cfs_zockt";
}

export async function publicTwitchState() {
  const login = configuredLogin();
  const user = await queryTwitch(`users?login=${encodeURIComponent(login)}`);
  const profile = Array.isArray(user?.data) ? user.data[0] : null;
  if (!profile?.id) {
    return { ok: true, live: false, status: "unknown", channel: login,
      title: "Live-Status nicht verfügbar", game: null, viewer_count: null,
      started_at: null, source: "fallback" };
  }
  const stream = await queryTwitch(`streams?user_id=${encodeURIComponent(profile.id)}`);
  if (!Array.isArray(stream?.data)) {
    return { ok: true, live: false, status: "unknown", channel: login,
      title: "Twitch-LIVE-Status wird geprüft", game: null, viewer_count: null,
      started_at: null, source: "fallback" };
  }
  const active = stream.data[0];
  if (!active) {
    return { ok: true, live: false, status: "offline", channel: profile.login || login,
      title: "Aktuell nicht live", game: null, viewer_count: null,
      started_at: null, source: "twitch" };
  }
  // Helix "streams" data is live only when the stream matches the
  // requested broadcaster and Twitch explicitly reports type "live".
  if (String(active.user_id || "") !== String(profile.id) || active.type !== "live") {
    return { ok: true, live: false, status: "unknown", channel: login,
      title: "Twitch-LIVE-Status wird geprüft", game: null, viewer_count: null,
      started_at: null, source: "fallback" };
  }
  const viewers = Number(active.viewer_count);
  return { ok: true, live: true, status: "live", channel: profile.login || login,
    title: typeof active.title === "string" ? active.title : "",
    game: typeof active.game_name === "string" ? active.game_name : null,
    viewer_count: Number.isSafeInteger(viewers) && viewers >= 0 ? viewers : null,
    started_at: active.started_at || null, source: "twitch" };
}

export async function publicTwitchCommunity() {
  const login = configuredLogin();
  const user = await queryTwitch(`users?login=${encodeURIComponent(login)}`);
  const profile = Array.isArray(user?.data) ? user.data[0] : null;
  if (!profile?.id) return { ok: true, twitch_followers: null, source: "fallback" };
  const follows = await queryTwitch(`channels/followers?broadcaster_id=${encodeURIComponent(profile.id)}`);
  const total = Number(follows?.total);
  return { ok: true,
    twitch_followers: Number.isSafeInteger(total) && total >= 0 && follows?.total != null ? total : null,
    source: follows ? "twitch" : "fallback" };
}

const twitchStreamCache = new Map();
const STREAM_CACHE_MS = 12000;

// Public widget data must come from the Twitch ID connected to the owning
// creator account, never the site's global TWITCH_CHANNEL_LOGIN.
export async function twitchStreamForUserId(userId) {
  const id = String(userId || "");
  if (!/^[0-9]{1,24}$/.test(id)) return { status: "unknown" };
  const cached = twitchStreamCache.get(id);
  if (cached && cached.until > Date.now()) return cached.value;
  if (cached) twitchStreamCache.delete(id);
  const stream = await queryTwitch(`streams?user_id=${encodeURIComponent(id)}`);
  let value = { status: "unknown" };
  if (Array.isArray(stream?.data)) {
    const active = stream.data[0];
    if (!active) {
      value = { status: "offline" };
    } else if (String(active.user_id || "") === id && active.type === "live") {
      const startedAt = typeof active.started_at === "string" ? Date.parse(active.started_at) : NaN;
      const age = Date.now() - startedAt;
      if (Number.isFinite(startedAt) && age >= 0 && age < 30 * 86400000) {
        value = { status: "live", started_at: new Date(startedAt).toISOString() };
      }
    }
  }
  if (twitchStreamCache.size >= 100) twitchStreamCache.clear();
  twitchStreamCache.set(id, { value, until: Date.now() + STREAM_CACHE_MS });
  return value;
}
