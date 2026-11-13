import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";
import { launcherAuthorized, UUID } from "./launcher-auth.js";
import { validatePlayStationSync } from "./playstation-validation.js";

// One launcher sync is one atomic operation. An invalid entry cannot leave a
// partially updated profile, game catalog or public video list behind.
export async function syncPlayStationFromLauncher(req, body) {
  if (!launcherAuthorized(req)) return { error: "LAUNCHER_UNAUTHORIZED", status: 401 };
  const deviceId = req?.headers?.["x-cfs-device-id"];
  if (typeof deviceId !== "string" || !UUID.test(deviceId))
    return { error: "DEVICE_ID_REQUIRED", status: 400 };
  const input = validatePlayStationSync(body);
  if (input.error) return input;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Keep the device row locked through commit. A concurrent revoke cannot
    // invalidate a sync halfway through its transaction.
    const active = await client.query(
      "update launcher_devices set last_seen_at=now(),updated_at=now() where id=$1 and status='active' and account_id is not null returning account_id",
      [deviceId]
    );
    const accountId = active.rows[0]?.account_id;
    if (!accountId) {
      await client.query("ROLLBACK");
      return { error: "DEVICE_NOT_ACTIVE", status: 403 };
    }
    // Two different paired devices may sync the same creator at once.
    // Serialize them by account so URL-based video reuse stays race-free.
    await client.query("select id from accounts where id=$1 for update", [accountId]);
    await client.query(
      `insert into creator_playstation_profiles(account_id,provider,platform,display_name,connected,updated_at)
       values($1,'launcher',$2,$3,true,now())
       on conflict(account_id) do update set provider='launcher',
       platform=case when $4 then excluded.platform else creator_playstation_profiles.platform end,
       display_name=case when $4 then excluded.display_name else creator_playstation_profiles.display_name end,
       connected=true,updated_at=now()`,
      [accountId, input.profile.platform, input.profile.display_name, body.profile !== undefined]
    );
    if (input.hasGames) {
      for (const game of input.games) {
        await client.query(
          `insert into creator_playstation_games
           (account_id,title,platform,cover_url,last_played_at,in_catalog,source,updated_at)
           values($1,$2,$3,$4,$5,$6,'launcher',now())
           on conflict(account_id,title,coalesce(platform,'')) do update set
             cover_url=excluded.cover_url,last_played_at=excluded.last_played_at,
             in_catalog=excluded.in_catalog,updated_at=now()`,
          [accountId, game.title, game.platform, game.cover_url, game.last_played_at, game.in_catalog]
        );
      }
    }
    if (input.hasVideos) {
      // Preserve IDs for unchanged URLs. No old rows are deleted by this safety release.
      for (const video of input.videos) {
        const existing = await client.query(
          "select id from creator_playstation_videos where account_id=$1 and source='launcher' and url=$2 order by updated_at desc,id limit 1",
          [accountId, video.url]
        );
        let id;
        if (existing.rows[0]) {
          id = existing.rows[0].id;
          await client.query(
            "update creator_playstation_videos set title=$3,thumbnail_url=$4,published_at=$5,updated_at=now() where id=$1 and account_id=$2",
            [id, accountId, video.title, video.thumbnail_url, video.published_at]
          );
        } else {
          const created = await client.query(
            `insert into creator_playstation_videos(account_id,title,url,thumbnail_url,published_at,source)
             values($1,$2,$3,$4,$5,'launcher') returning id`,
            [accountId, video.title, video.url, video.thumbnail_url, video.published_at]
          );
          id = created.rows[0].id;
        }
      }
      // Deletion/pruning semantics are intentionally not enabled in this release.
      // In particular, an explicit empty array must not erase historical videos.
    }
    await client.query("COMMIT");
    return { ok: true, connected: true, games_synced: input.hasGames ? input.games.length : 0,
      videos_synced: input.hasVideos ? input.videos.length : 0,
      synced_at: new Date().toISOString() };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function getPlayStationState(req) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const pool = getPool();
  const profile = (await pool.query("select provider, platform, display_name, connected, updated_at from creator_playstation_profiles where account_id=$1", [account.id])).rows[0] || null;
  const games = (await pool.query("select id, title, platform, cover_url, last_played_at, in_catalog, source from creator_playstation_games where account_id=$1 order by last_played_at desc nulls last, title asc", [account.id])).rows;
  const videos = (await pool.query("select id, title, url, thumbnail_url, published_at, source from creator_playstation_videos where account_id=$1 order by published_at desc nulls last, title asc", [account.id])).rows;
  return { ok: true, connected: Boolean(profile?.connected), profile, recent_games: games.filter(game => game.last_played_at).slice(0, 3), game_catalog: games, videos, limits: { recent_games: 3 }, source: profile?.provider || "launcher", message: videos.length ? "PlayStation-Daten geladen." : "Keine bestätigte Videoquelle verfügbar." };
}

export async function publicPlayStationState(){
  const emails=[process.env.CFS_ADMIN_DESKTOP_OWNER_EMAIL,...String(process.env.CFS_ADMIN_EMAILS||"").split(",")].map(x=>String(x||"").trim().toLowerCase()).filter(Boolean);
  if(!emails.length)return{ok:true,connected:false,recent_games:[],game_catalog:[],videos:[],limits:{recent_games:3},message:"PlayStation Network ist noch nicht veröffentlicht."};
  const pool=getPool(),account=(await pool.query("select id from accounts where lower(email)=any($1::text[]) order by created_at asc limit 1",[emails])).rows[0];
  if(!account)return{ok:true,connected:false,recent_games:[],game_catalog:[],videos:[],limits:{recent_games:3},message:"PlayStation Network ist noch nicht verbunden."};
  const profile=(await pool.query("select provider,platform,display_name,connected,updated_at from creator_playstation_profiles where account_id=$1",[account.id])).rows[0]||null;
  const games=(await pool.query("select title,platform,cover_url,last_played_at,in_catalog from creator_playstation_games where account_id=$1 order by last_played_at desc nulls last,title asc",[account.id])).rows;
  const videos=(await pool.query("select title,url,thumbnail_url,published_at from creator_playstation_videos where account_id=$1 order by published_at desc nulls last,title asc",[account.id])).rows;
  return{ok:true,connected:Boolean(profile?.connected),profile:profile?{platform:profile.platform,display_name:profile.display_name,updated_at:profile.updated_at}:null,recent_games:games.filter(x=>x.last_played_at).slice(0,3),game_catalog:games,videos,limits:{recent_games:3},message:videos.length?"PlayStation-Daten geladen.":"Keine bestätigte Videoquelle verfügbar."};
}
