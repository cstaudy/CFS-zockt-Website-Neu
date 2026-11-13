import { isIP } from "node:net";

// Public data is historical launcher activity, not a real-time playing status.
// Do not expose private account metadata or invent playtime/session totals.
const PLATFORM = Object.freeze({
  ps5: "playstation_5", "playstation 5": "playstation_5",
  ps4: "playstation_4", "playstation 4": "playstation_4",
  pc: "pc", "xbox series": "xbox_series", "xbox one": "xbox_one",
  switch: "switch", "nintendo switch": "switch"
});
const KNOWN_SYNC_STATES = new Set(["current", "offline", "stale", "unavailable"]);

function publicCoverUrl(value) {
  if (typeof value !== "string" || !value || value.length > 500) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password ||
        url.port || url.hash || !host.includes(".") || isIP(host) ||
        /\.(?:local|localhost|internal|test|invalid)$/.test(host)) return null;
    return url.href;
  } catch { return null; }
}

function publicDate(value) {
  if (!(value instanceof Date) && typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function gameView(game) {
  if (!game || typeof game.title !== "string" || !game.title.trim()) return null;
  return {
    name: game.title.trim().slice(0, 160),
    platform: PLATFORM[String(game.platform || "").toLowerCase()] || "unknown",
    image_url: publicCoverUrl(game.cover_url),
    last_played_at: publicDate(game.last_played_at),
    source: "launcher_playstation"
  };
}

export function publicGamesFromPlayStation(state) {
  // A disconnected account must not leak previously stored private history.
  const connected = state?.connected === true;
  const games = connected
    ? (Array.isArray(state?.game_catalog) ? state.game_catalog : [])
      .slice(0, 500).map(gameView).filter(Boolean)
    : [];
  const recent = connected
    ? (Array.isArray(state?.recent_games) ? state.recent_games : [])
      .slice(0, 50).map(gameView).filter(game => game && game.last_played_at)
      .sort((a, b) => Date.parse(b.last_played_at) - Date.parse(a.last_played_at))
    : [];
  const sourceState = connected ? state?.sync_state : "unavailable";
  const syncState = KNOWN_SYNC_STATES.has(sourceState) ? sourceState : "unavailable";
  return {
    ok: true,
    available: connected && (games.length > 0 || recent.length > 0),
    source: connected ? "launcher_playstation" : "unavailable",
    sync_state: syncState,
    last_synced_at: connected ? publicDate(state?.last_synced_at || state?.profile?.updated_at) : null,
    stale: syncState !== "current",
    active: null,
    playtime_scope: null,
    window_days: null,
    recent,
    games,
    recent_games: recent,
    message: connected
      ? "Historische PlayStation-Daten; kein aktives Spiel oder Spielzeit bestätigt."
      : "Noch keine bestätigten Spieldaten vorhanden."
  };
}
