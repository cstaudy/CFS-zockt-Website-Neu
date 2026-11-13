// Public gaming projection: only historically recorded launcher/PlayStation
// entries, never demo games, inferred playtime, purchases, or a fake live game.
const PLATFORM = {
  ps5: "playstation_5", "playstation 5": "playstation_5",
  ps4: "playstation_4", "playstation 4": "playstation_4",
  pc: "pc", "xbox series": "xbox_series", "xbox one": "xbox_one",
  switch: "switch", "nintendo switch": "switch"
};
function gameView(game) {
  if (!game || typeof game.title !== "string" || !game.title.trim()) return null;
  return {
    name: game.title.trim(),
    platform: PLATFORM[String(game.platform || "").toLowerCase()] || "unknown",
    image_url: game.cover_url || null,
    last_played_at: game.last_played_at || null,
    source: "launcher_playstation"
  };
}
export function publicGamesFromPlayStation(state) {
  const catalog = (Array.isArray(state?.game_catalog) ? state.game_catalog : [])
    .map(gameView).filter(Boolean);
  const recent = (Array.isArray(state?.recent_games) ? state.recent_games : [])
    .map(gameView).filter(game => game && game.last_played_at);
  const connected = state?.connected === true;
  const stale = state?.sync_state !== "current";
  return {
    ok: true,
    available: connected && (catalog.length > 0 || recent.length > 0),
    source: connected ? "launcher_playstation" : "unavailable",
    sync_state: state?.sync_state || "unavailable",
    last_synced_at: state?.last_synced_at || null,
    stale, active: null,
    playtime_scope: null, window_days: null,
    recent, games: catalog,
    recent_games: recent,
    message: state?.message || "Noch keine bestätigte Spielaktivität vorhanden."
  };
}
