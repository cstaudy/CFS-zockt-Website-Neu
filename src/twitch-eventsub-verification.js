import { createHmac, timingSafeEqual } from "node:crypto";

// Pure, deliberately unmounted EventSub validation helpers. No webhook route,
// database table or Twitch subscription is activated by importing this module.

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
  // Restrict this verifier to Twitch's webhook transport, not websocket or conduit data.
  if (payload.subscription.transport !== undefined &&
      (!isObject(payload.subscription.transport) ||
       payload.subscription.transport.method !== "webhook"))
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

