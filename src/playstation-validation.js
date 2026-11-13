import { isIP } from "node:net";

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
function isoDate(value) {
  if (typeof value !== "string" || value.length > 40) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  return y >= 1970 && y <= 2100 && m >= 1 && m <= 12 &&
    d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate() &&
    Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59 &&
    (offsetHour === undefined || (Number(offsetHour) <= 23 && Number(offsetMinute) <= 59));
}
const optionalText = (value, limit) => value === undefined || value === null ||
  (typeof value === "string" && value.length <= limit);
const optionalDate = value => value === undefined || value === null || isoDate(value);

export function safePlayStationUrl(value, limit = 1000) {
  if (typeof value !== "string" || value.length < 1 || value.length > limit) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const ipHost = hostname.replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        url.hash || hostname.endsWith(".") || !hostname.includes(".") ||
        isIP(ipHost) || hostname === "localhost" ||
        /\.(?:local|localhost|internal|test|invalid)$/.test(hostname)) return null;
    return url.href;
  } catch { return null; }
}

export function validatePlayStationSync(body) {
  if (!isObject(body)) return { error: "INVALID_PLAYSTATION_SYNC", status: 400 };
  if (Buffer.byteLength(JSON.stringify(body), "utf8") > 512 * 1024)
    return { error: "PLAYSTATION_SYNC_TOO_LARGE", status: 413 };
  if (body.profile !== undefined && !isObject(body.profile))
    return { error: "INVALID_PLAYSTATION_PROFILE", status: 400 };
  const profile = body.profile || {};
  if (!optionalText(profile.platform, 40) || !optionalText(profile.display_name, 120))
    return { error: "INVALID_PLAYSTATION_PROFILE", status: 400 };
  if (body.games !== undefined && (!Array.isArray(body.games) || body.games.length > 500))
    return { error: "INVALID_PLAYSTATION_GAMES", status: 400 };
  if (body.videos !== undefined && (!Array.isArray(body.videos) || body.videos.length > 100))
    return { error: "INVALID_PLAYSTATION_VIDEOS", status: 400 };

  const games = new Map();
  for (const game of body.games || []) {
    if (!isObject(game) || typeof game.title !== "string" || !game.title.trim() ||
        game.title.length > 160 || !optionalText(game.platform, 40) ||
        !optionalText(game.cover_url, 500) || !optionalDate(game.last_played_at) ||
        (game.in_catalog !== undefined && typeof game.in_catalog !== "boolean") ||
        (game.cover_url && !safePlayStationUrl(game.cover_url, 500)))
      return { error: "INVALID_PLAYSTATION_GAME", status: 400 };
    const title = game.title.trim();
    const platform = game.platform?.trim() || null;
    games.set(title + "\u0000" + (platform || ""), {
      title, platform, cover_url: game.cover_url ? safePlayStationUrl(game.cover_url, 500) : null,
      last_played_at: game.last_played_at || null, in_catalog: game.in_catalog !== false
    });
  }
  const videos = new Map();
  for (const video of body.videos || []) {
    if (!isObject(video) || typeof video.title !== "string" || !video.title.trim() ||
        video.title.length > 160 || !optionalText(video.thumbnail_url, 500) ||
        !optionalDate(video.published_at) || !safePlayStationUrl(video.url) ||
        (video.thumbnail_url && !safePlayStationUrl(video.thumbnail_url, 500)))
      return { error: "INVALID_PLAYSTATION_VIDEO", status: 400 };
    const url = safePlayStationUrl(video.url);
    videos.set(url, { title: video.title.trim(), url,
      thumbnail_url: video.thumbnail_url ? safePlayStationUrl(video.thumbnail_url, 500) : null,
      published_at: video.published_at || null });
  }
  return { profile: { platform: profile.platform?.trim() || null,
      display_name: profile.display_name?.trim() || null },
    games: [...games.values()], videos: [...videos.values()],
    hasGames: body.games !== undefined, hasVideos: body.videos !== undefined };
}
