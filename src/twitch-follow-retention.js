import { getPool } from "./db.js";

const MAX_BATCH = 1000;

// Retain follower identity data for no longer than 30 days, even when no new
// events arrive. SKIP LOCKED keeps cleanup safe across multiple app workers.
export async function pruneExpiredTwitchFollows(db = getPool()) {
  if (!db) return { deleted: 0, configured: false };
  const result = await db.query(
    `with expired as (
       select id from twitch_follow_events
       where followed_at < now()-interval '30 days'
          or received_at < now()-interval '30 days'
       order by received_at asc, id asc
       limit $1 for update skip locked
     )
     delete from twitch_follow_events e using expired
     where e.id=expired.id returning e.id`,
    [MAX_BATCH]
  );
  return { deleted: result.rowCount, configured: true };
}

// The application periodically runs this query; an idle account's follower
// names must expire without waiting for another follow notification.
export function startTwitchFollowRetention() {
  async function sweep() {
    try {
      const result = await pruneExpiredTwitchFollows();
      if (result.deleted) console.info("twitch_follow_retention_pruned", result.deleted);
    } catch (error) {
      console.error("twitch_follow_retention_failed", error?.message || "DATABASE_UNAVAILABLE");
    }
  }
  const first = setTimeout(sweep, 60_000);
  const repeating = setInterval(sweep, 60 * 60_000);
  first.unref();
  repeating.unref();
  return () => { clearTimeout(first); clearInterval(repeating); };
}
