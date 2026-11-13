import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";
import { eventSubConfigured } from "./twitch-eventsub.js";

const hasFollowScope = value => String(value || "").split(/[\s,]+/).includes("moderator:read:followers");
const validUser = value => /^[0-9]{1,24}$/.test(String(value || ""));
const validSubscription = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

function callbackUrl() {
  const base = process.env.TWITCH_EVENTSUB_CALLBACK_URL ||
    (process.env.APP_BASE_URL ? new URL("/api/webhooks/twitch/eventsub", process.env.APP_BASE_URL).href : "");
  if (!base) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.port || url.username || url.password ||
        url.search || url.hash || url.pathname !== "/api/webhooks/twitch/eventsub") return null;
    return url.href;
  } catch { return null; }
}

export async function getTwitchFollowStatus(req) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const found = await getPool().query(
    `select c.twitch_user_id,c.scope,s.subscription_id,s.status
     from twitch_connections c left join twitch_follow_subscriptions s
       on s.account_id=c.account_id and s.broadcaster_user_id=c.twitch_user_id
     where c.account_id=$1`,
    [account.id]
  );
  const row = found.rows[0];
  return { ok: true, connected: !!row, permissions_granted: hasFollowScope(row?.scope),
    configured: eventSubConfigured() && !!callbackUrl(),
    subscription_status: row?.status || "unavailable",
    enabled: row?.status === "enabled",
    needs_reauthorization: !!row && !hasFollowScope(row.scope) };
}

export async function enableTwitchFollowEvents(req) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!eventSubConfigured() || !process.env.TWITCH_CLIENT_ID ||
      !process.env.TWITCH_CLIENT_SECRET || !callbackUrl())
    return { error: "TWITCH_EVENTSUB_NOT_CONFIGURED", status: 503 };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("select id from accounts where id=$1 for update", [account.id]);
    const connected = await client.query(
      "select twitch_user_id,scope from twitch_connections where account_id=$1",
      [account.id]
    );
    const user = connected.rows[0];
    if (!user || !validUser(user.twitch_user_id)) {
      await client.query("ROLLBACK");
      return { error: "TWITCH_NOT_CONNECTED", status: 409 };
    }
    if (!hasFollowScope(user.scope)) {
      await client.query("ROLLBACK");
      return { error: "TWITCH_FOLLOW_SCOPE_REQUIRED", status: 409 };
    }
    const existing = await client.query(
      "select subscription_id,status,broadcaster_user_id from twitch_follow_subscriptions where account_id=$1",
      [account.id]
    );
    const active = existing.rows[0];
    if (active && active.broadcaster_user_id === user.twitch_user_id &&
        ["pending", "enabled"].includes(active.status)) {
      await client.query("COMMIT");
      return { ok: true, subscription_status: active.status };
    }
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: "client_credentials"
      }), signal: AbortSignal.timeout(7000)
    });
    if (!tokenResponse.ok) {
      await client.query("ROLLBACK");
      return { error: "TWITCH_APP_AUTH_FAILED", status: 502 };
    }
    const token = await tokenResponse.json();
    if (!token?.access_token) {
      await client.query("ROLLBACK");
      return { error: "TWITCH_APP_AUTH_FAILED", status: 502 };
    }
    const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Client-Id": process.env.TWITCH_CLIENT_ID,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: "channel.follow", version: "2",
        condition: {
          broadcaster_user_id: String(user.twitch_user_id),
          moderator_user_id: String(user.twitch_user_id)
        },
        transport: {
          method: "webhook", callback: callbackUrl(),
          secret: process.env.TWITCH_EVENTSUB_SECRET
        }
      }), signal: AbortSignal.timeout(7000)
    });
    if (response.status !== 202) {
      await client.query("ROLLBACK");
      return { error: response.status === 409 ? "TWITCH_EVENTSUB_ALREADY_EXISTS" : "TWITCH_EVENTSUB_SUBSCRIBE_FAILED",
        status: response.status === 409 ? 409 : 502 };
    }
    const responseData = await response.json();
    const subscription = Array.isArray(responseData?.data) ? responseData.data[0] : null;
    if (!validSubscription(subscription?.id) ||
        String(subscription?.condition?.broadcaster_user_id) !== String(user.twitch_user_id) ||
        subscription?.type !== "channel.follow" || subscription?.version !== "2") {
      await client.query("ROLLBACK");
      return { error: "TWITCH_EVENTSUB_INVALID_RESPONSE", status: 502 };
    }
    const verification = await client.query(
      `select 1 from twitch_follow_challenges
       where subscription_id=$1 and broadcaster_user_id=$2
         and verified_at > now()-interval '10 minutes'`,
      [subscription.id, user.twitch_user_id]
    );
    const initialStatus = verification.rows[0] ? "enabled" : "pending";
    await client.query(
      `insert into twitch_follow_subscriptions
       (account_id,subscription_id,broadcaster_user_id,status)
       values($1,$2,$3,$4)
       on conflict(account_id) do update
       set subscription_id=excluded.subscription_id,
           broadcaster_user_id=excluded.broadcaster_user_id,
           status=case when twitch_follow_subscriptions.subscription_id=excluded.subscription_id
             and twitch_follow_subscriptions.status='enabled' then 'enabled'
             else excluded.status end,updated_at=now()`,
      [account.id, subscription.id, user.twitch_user_id, initialStatus]
    );
    // Changing the account or subscription invalidates previously received follows.
    await client.query("delete from twitch_follow_events where account_id=$1", [account.id]);
    await client.query("COMMIT");
    const current = await pool.query(
      "select status from twitch_follow_subscriptions where account_id=$1 and subscription_id=$2",
      [account.id, subscription.id]
    );
    return { ok: true, subscription_status: current.rows[0]?.status || initialStatus };
  } catch(error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.name === "TimeoutError" || error.name === "AbortError" || error instanceof TypeError)
      return { error: "TWITCH_EVENTSUB_PROVIDER_UNAVAILABLE", status: 502 };
    throw error;
  } finally { client.release(); }
}
