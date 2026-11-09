import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";

export async function getPlayStationState(req) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const pool = getPool();
  const profile = (await pool.query("select provider, platform, display_name, connected, updated_at from creator_playstation_profiles where account_id=$1", [account.id])).rows[0] || null;
  const games = (await pool.query("select id, title, platform, cover_url, last_played_at, in_catalog, source from creator_playstation_games where account_id=$1 order by last_played_at desc nulls last, title asc", [account.id])).rows;
  const videos = (await pool.query("select id, title, url, thumbnail_url, published_at, source from creator_playstation_videos where account_id=$1 order by published_at desc nulls last, title asc", [account.id])).rows;
  return { ok: true, connected: Boolean(profile?.connected), profile, recent_games: games.filter(game => game.last_played_at).slice(0, 3), game_catalog: games, videos, limits: { recent_games: 3 }, source: profile?.provider || "launcher", message: videos.length ? "PlayStation-Daten geladen." : "Keine bestätigte Videoquelle verfügbar." };
}

