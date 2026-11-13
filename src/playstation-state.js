import { safePlayStationUrl } from "./playstation-validation.js";

export const PLAYSTATION_FRESH_MS = 10 * 60 * 1000;
export const LAUNCHER_ONLINE_MS = 2 * 60 * 1000;
const validTime = value => {
  const time = value instanceof Date ? value.getTime() : Date.parse(value || "");
  return Number.isFinite(time) ? time : null;
};
const cleanImage = value => value ? safePlayStationUrl(value, 500) : null;

// A launcher importing a played game is not evidence that a game is active now.
// "connected" remains a historical integration flag for old API consumers;
// "online" and "sync_state" describe the actual source freshness.
export function projectPlayStationState({ profile = null, games = [], videos = [],
  lastLauncherSeenAt = null, now = Date.now(), publicView = false } = {}) {
  const connected = profile?.connected === true;
  const lastSyncMs = validTime(profile?.updated_at);
  const lastSeenMs = validTime(lastLauncherSeenAt);
  const syncAgeMs = lastSyncMs === null ? null : Math.max(0, now - lastSyncMs);
  const fresh = connected && lastSyncMs !== null && lastSyncMs <= now + 60_000 &&
    syncAgeMs <= PLAYSTATION_FRESH_MS;
  const launcherOnline = connected && lastSeenMs !== null &&
    lastSeenMs <= now + 60_000 && now - lastSeenMs <= LAUNCHER_ONLINE_MS;
  const online = fresh && launcherOnline;
  const syncState = !connected || lastSyncMs === null ? "unavailable"
    : !fresh ? "stale" : !launcherOnline ? "offline" : "current";
  const message = {
    unavailable: "Noch keine bestätigte PlayStation-Synchronisierung vorhanden.",
    stale: "PlayStation-Daten sind veraltet. Letzte gespeicherte Daten werden angezeigt.",
    offline: "Launcher offline. Letzte gespeicherte PlayStation-Daten werden angezeigt.",
    current: "PlayStation-Daten vom verbundenen Launcher aktuell."
  }[syncState];
  const normalizedGames = (Array.isArray(games) ? games : []).slice(0, 500)
    .filter(game => game && typeof game.title === "string" && game.title.trim())
    .map(game => ({
      ...(!publicView && game.id ? { id: game.id } : {}),
      title: game.title, platform: game.platform || null,
      cover_url: cleanImage(game.cover_url),
      last_played_at: game.last_played_at || null,
      in_catalog: game.in_catalog === true,
      ...(!publicView ? { source: game.source || "launcher" } : {})
    }));
  const catalog = normalizedGames.filter(game => game.in_catalog);
  const recent = normalizedGames.filter(game => validTime(game.last_played_at) !== null)
    .sort((a, b) => validTime(b.last_played_at) - validTime(a.last_played_at)).slice(0, 3);
  const normalizedVideos = (Array.isArray(videos) ? videos : []).slice(0, 100)
    .filter(video => video && typeof video.title === "string" && safePlayStationUrl(video.url))
    .map(video => ({
      ...(!publicView && video.id ? { id: video.id } : {}),
      title: video.title, url: safePlayStationUrl(video.url),
      thumbnail_url: cleanImage(video.thumbnail_url),
      published_at: video.published_at || null,
      ...(!publicView ? { source: video.source || "launcher" } : {})
    }));
  return {
    ok: true, connected, online, launcher_online: launcherOnline,
    sync_state: syncState,
    last_synced_at: lastSyncMs === null ? null : new Date(lastSyncMs).toISOString(),
    profile: profile ? {
      provider: profile.provider || "launcher",
      platform: profile.platform || null, display_name: profile.display_name || null,
      updated_at: profile.updated_at || null
    } : null,
    active_game: null, // The launcher sends history, not real-time activity.
    recent_games: recent, game_catalog: catalog, videos: normalizedVideos,
    limits: { recent_games: 3 }, source: profile?.provider || "launcher", message
  };
}
