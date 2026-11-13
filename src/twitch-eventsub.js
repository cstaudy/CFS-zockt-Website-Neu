import { createHmac, timingSafeEqual } from "node:crypto";
import { getPool } from "./db.js";

const TYPES = new Set(["notification", "webhook_callback_verification", "revocation"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TWITCH_ID = /^[0-9]{1,24}$/;
const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

export function eventSubConfigured() {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  return typeof secret === "string" && /^[\x21-\x7e]{32,100}$/.test(secret);
}

export async function readEventSubBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("EVENTSUB_PAYLOAD_TOO_LARGE"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function verifyEventSubMessage(headers, rawBody, secret, now = Date.now()) {
  if (typeof secret !== "string" || !/^[\x21-\x7e]{32,100}$/.test(secret))
    return { error: "EVENTSUB_NOT_CONFIGURED", status: 503 };
  if (!Buffer.isBuffer(rawBody) || !rawBody.length || rawBody.length > MAX_BODY_BYTES)
    return { error: "INVALID_EVENTSUB_BODY", status: 400 };
  const id = headers?.["twitch-eventsub-message-id"];
  const timestamp = headers?.["twitch-eventsub-message-timestamp"];
  const signature = headers?.["twitch-eventsub-message-signature"];
  const type = headers?.["twitch-eventsub-message-type"];
  const subscriptionType = headers?.["twitch-eventsub-subscription-type"];
  const version = headers?.["twitch-eventsub-subscription-version"];
  if (typeof id !== "string" || !/^[\x21-\x7e]{1,128}$/.test(id) ||
      typeof timestamp !== "string" || timestamp.length > 50 ||
      !Number.isFinite(Date.parse(timestamp)) || Math.abs(now - Date.parse(timestamp)) > WINDOW_MS ||
      !TYPES.has(type) || subscriptionType !== "channel.follow" || version !== "2" ||
      typeof signature !== "string" || !/^sha256=[0-9a-f]{64}$/i.test(signature))
    return { error: "INVALID_EVENTSUB_HEADERS", status: 403 };
  const expected = "sha256=" + createHmac("sha256", secret)
    .update(id).update(timestamp).update(rawBody).digest("hex");
  if (!timingSafeEqual(Buffer.from(expected, "ascii"), Buffer.from(signature.toLowerCase(), "ascii")))
    return { error: "INVALID_EVENTSUB_SIGNATURE", status: 403 };
  let payload;
  try { payload = JSON.parse(rawBody.toString("utf8")); }
  catch { return { error: "INVALID_EVENTSUB_JSON", status: 400 }; }
  if (!isObject(payload) || !isObject(payload.subscription) ||
      !UUID.test(String(payload.subscription.id)) ||
      payload.subscription.type !== "channel.follow" || payload.subscription.version !== "2" ||
      !isObject(payload.subscription.condition) ||
      !TWITCH_ID.test(String(payload.subscription.condition.broadcaster_user_id)) ||
      String(payload.subscription.condition.moderator_user_id) !== String(payload.subscription.condition.broadcaster_user_id))
    return { error: "INVALID_EVENTSUB_SUBSCRIPTION", status: 400 };
  if (type === "webhook_callback_verification" &&
      (typeof payload.challenge !== "string" || !/^[\x20-\x7e]{1,512}$/.test(payload.challenge)))
    return { error: "INVALID_EVENTSUB_CHALLENGE", status: 400 };
  if (type === "notification") {
    const event = payload.event;
    if (!isObject(event) || String(event.broadcaster_user_id) !== String(payload.subscription.condition.broadcaster_user_id) ||
        !TWITCH_ID.test(String(event.user_id)) || typeof event.user_name !== "string" ||
        !event.user_name.trim() || event.user_name.length > 100 ||
        typeof event.followed_at !== "string" || !Number.isFinite(Date.parse(event.followed_at)) ||
        Date.parse(event.followed_at) > now + 60000 || Date.parse(event.followed_at) < now - 30 * 86400000)
      return { error: "INVALID_EVENTSUB_FOLLOW", status: 400 };
  }
  return { id, type, payload };
}

export async function handleTwitchEventSub(req, rawBody) {
  const verified = verifyEventSubMessage(req.headers, rawBody, process.env.TWITCH_EVENTSUB_SECRET);
  if (verified.error) return verified;
  const { id, type, payload } = verified;
  const subscription = payload.subscription;
  const broadcasterId = String(subscription.condition.broadcaster_user_id);
  const pool = getPool();
  if (type === "webhook_callback_verification") {
    // Twitch may send the challenge before its subscription-creation request
    // returns. Only accept callbacks for already-linked, consenting accounts.
    const found = await pool.query(
      "select 1 from twitch_connections where twitch_user_id=$1 and ('moderator:read:followers'=any(regexp_split_to_array(scope,'[, ]+'))) limit 1",
      [broadcasterId]
    );
    if (!found.rows[0]) return { error: "EVENTSUB_BROADCASTER_NOT_LINKED", status: 403 };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `insert into twitch_follow_challenges (subscription_id,broadcaster_user_id)
         values($1,$2)
         on conflict(subscription_id) do update set verified_at=now()
         where twitch_follow_challenges.broadcaster_user_id=excluded.broadcaster_user_id`,
        [subscription.id, broadcasterId]
      );
      await client.query(
        `update twitch_follow_subscriptions set status='enabled',updated_at=now()
         where subscription_id=$1 and broadcaster_user_id=$2 and status='pending'`,
        [subscription.id, broadcasterId]
      );
      await client.query(
        "delete from twitch_follow_challenges where verified_at < now()-interval '7 days'"
      );
      await client.query("COMMIT");
    } catch(error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
    return { challenge: payload.challenge, status: 200 };
  }
  if (type === "revocation") {
    // Revocation invalidates all stored names for that subscription,
    // not just the public projection. Ignore unknown/old subscription IDs.
    await pool.query(
      `with revoked as (
         update twitch_follow_subscriptions
         set status='revoked',updated_at=now()
         where subscription_id=$1 and broadcaster_user_id=$2
         returning account_id
       )
       delete from twitch_follow_events
       where account_id in (select account_id from revoked)`,
      [subscription.id, broadcasterId]
    );
    return { ok: true, status: 204 };
  }
  const event = payload.event;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const linked = await client.query(
      `select s.account_id from twitch_follow_subscriptions s
       join twitch_connections c on c.account_id=s.account_id
       where s.subscription_id=$1 and s.broadcaster_user_id=$2
         and c.twitch_user_id=$2 and s.status='enabled'
         and ('moderator:read:followers'=any(regexp_split_to_array(c.scope,'[, ]+')))
       for update of s`,
      [subscription.id, broadcasterId]
    );
    if (!linked.rows[0]) {
      await client.query("ROLLBACK");
      return { error: "EVENTSUB_SUBSCRIPTION_UNKNOWN", status: 403 };
    }
    const accountId = linked.rows[0].account_id;
    const result = await client.query(
      `insert into twitch_follow_events
       (account_id,message_id,broadcaster_user_id,follower_user_id,follower_name,followed_at)
       values($1,$2,$3,$4,$5,$6::timestamptz)
       on conflict(message_id) do nothing returning id`,
      [accountId, id, broadcasterId, String(event.user_id),
        event.user_name.trim().slice(0, 100), event.followed_at]
    );
    if (result.rows[0]) {
      await client.query(
        `delete from twitch_follow_events where account_id=$1
         and (followed_at < now()-interval '30 days'
           or id in (select id from twitch_follow_events where account_id=$1
             order by followed_at desc,received_at desc offset 500))`,
        [accountId]
      );
    }
    await client.query("COMMIT");
    return { ok: true, duplicate: !result.rows[0], status: 204 };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}
