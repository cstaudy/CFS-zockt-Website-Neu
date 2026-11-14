import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  eventSubConfigured, readEventSubBody, verifyEventSubMessage
} from "../src/twitch-eventsub-verification.js";

const secret = "ci-twitch-eventsub-random-local-secret-2026-11-14";
const now = Date.parse("2026-11-14T00:00:00.000Z");
const time = new Date(now).toISOString();
const subscription = {
  id: "123e4567-e89b-42d3-a456-426614174001",
  type: "channel.follow", version: "2",
  condition: { broadcaster_user_id: "12345", moderator_user_id: "12345" },
  transport: { method: "webhook", callback: "https://example.test/api/webhooks/twitch/eventsub" }
};
const event = {
  broadcaster_user_id: "12345", user_id: "987",
  user_name: "<script>alert('not html')</script>",
  followed_at: new Date(now - 8000).toISOString()
};
function signed(payload, type = "notification", opts = {}) {
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload));
  const id = opts.id ?? "ci-follow-message-001";
  const timestamp = opts.timestamp ?? time;
  const signature = "sha256=" + createHmac("sha256", secret)
    .update(id).update(timestamp).update(bytes).digest("hex");
  return {
    bytes,
    headers: {
      "twitch-eventsub-message-id": id,
      "twitch-eventsub-message-timestamp": timestamp,
      "twitch-eventsub-message-type": type,
      "twitch-eventsub-message-signature": signature,
      "twitch-eventsub-subscription-type": "channel.follow",
      "twitch-eventsub-subscription-version": "2"
    }
  };
}
function checkError(input, status, why) {
  assert.equal(verifyEventSubMessage(input.headers, input.bytes, secret, now).status,
    status, why);
}
const good = signed({ subscription, event });
const verified = verifyEventSubMessage(good.headers, good.bytes, secret, now);
assert.equal(verified.type, "notification");
assert.equal(verified.id, "ci-follow-message-001");
assert.equal(verified.payload.event.user_name, event.user_name);

checkError({ ...good, headers: { ...good.headers,
  "twitch-eventsub-message-signature": "sha256=" + "0".repeat(64) } }, 403,
"Incorrect signature is rejected");
checkError({ ...good, bytes: Buffer.from("{}") }, 403,
"Exact raw payload bytes are signed");
checkError({ ...good, headers: { ...good.headers,
  "twitch-eventsub-message-signature": "bad-prefix" } }, 403,
"Malformed signature cannot skip HMAC check");
checkError({ ...good, headers: { ...good.headers,
  "twitch-eventsub-subscription-version": "1" } }, 403,
"Only channel.follow v2 is supported");
checkError({ ...good, headers: { ...good.headers,
  "twitch-eventsub-message-type": "unknown" } }, 403,
"Only known webhook message types are supported");
checkError({ ...good, headers: { ...good.headers,
  "twitch-eventsub-message-id": "changed-id" } }, 403,
"Message ID is part of the signed bytes");
checkError({ ...good, headers: { ...good.headers,
  "twitch-eventsub-message-timestamp": new Date(now - 11000).toISOString() } }, 403,
"Timestamp is part of the signed bytes");

checkError(signed({ subscription, event }, "notification", {
  timestamp: new Date(now - 11 * 60000).toISOString()
}), 403, "Expired messages cannot be replayed");
checkError(signed({ subscription, event }, "notification", {
  timestamp: new Date(now + 11 * 60000).toISOString()
}), 403, "Too-far-future messages are invalid");
assert.equal(verifyEventSubMessage(good.headers, good.bytes, "short", now).status,
  503, "Weak or absent secret fails closed");
assert.equal(verifyEventSubMessage(good.headers, Buffer.alloc(0), secret, now).status,
  400, "Empty body is rejected");
assert.equal(verifyEventSubMessage(good.headers, Buffer.alloc(65537), secret, now).status,
  400, "Oversized raw payload is rejected before HMAC");

checkError(signed({ subscription, event: { ...event, broadcaster_user_id: "876" } }),
  400, "Notification must match subscription broadcaster");
checkError(signed({ subscription, event: { ...event, user_id: "not-numeric" } }),
  400, "Follower must have numeric Twitch ID");
checkError(signed({ subscription, event: { ...event, followed_at: "bad-date" } }),
  400, "Malformed follow time is invalid");
checkError(signed({ subscription, event: { ...event,
  followed_at: new Date(now + 90000).toISOString() } }),
  400, "Future-dated follows are invalid");
checkError(signed({ subscription, event: { ...event,
  followed_at: new Date(now - 31 * 86400000).toISOString() } }),
  400, "Old follower PII cannot be ingested");
checkError(signed({ subscription: { ...subscription, id: "bad" }, event }),
  400, "Subscription UUID is validated");
checkError(signed({ subscription: { ...subscription,
  condition: { ...subscription.condition, moderator_user_id: "other" } }, event }),
  400, "Subscription must be for the consenting broadcaster/moderator identity");
checkError(signed({ subscription: { ...subscription,
  transport: { method: "websocket" } }, event }),
  400, "Websocket subscription data cannot be processed by webhook handler");
checkError(signed([]), 400, "Array JSON is never accepted as a follow event");
checkError(signed(Buffer.from("{")), 400, "Signed invalid JSON is rejected");

const challenge = signed({ subscription, challenge: "ci-verification-challenge" },
  "webhook_callback_verification");
assert.equal(verifyEventSubMessage(challenge.headers, challenge.bytes, secret, now)
  .payload.challenge, "ci-verification-challenge");
checkError(signed({ subscription, challenge: "\nunsafe" },
  "webhook_callback_verification"), 400, "Challenge must be a bounded printable string");
const revocation = signed({ subscription, subscription_status: "authorization_revoked" }, "revocation");
assert.equal(verifyEventSubMessage(revocation.headers, revocation.bytes, secret, now).type,
  "revocation");

async function* chunks(parts) {
  for (const part of parts) yield part;
}
assert.deepEqual(await readEventSubBody(chunks([Buffer.from("ab"), Buffer.from("cd")])),
  Buffer.from("abcd"), "Raw chunks must be retained exactly");
await assert.rejects(readEventSubBody(chunks([
  Buffer.alloc(64 * 1024), Buffer.from("too much")
])), error => error?.status === 413, "Streaming request must enforce 64 KiB limit");

const before = process.env.TWITCH_EVENTSUB_SECRET;
try {
  process.env.TWITCH_EVENTSUB_SECRET = "short";
  assert.equal(eventSubConfigured(), false);
  process.env.TWITCH_EVENTSUB_SECRET = secret;
  assert.equal(eventSubConfigured(), true);
} finally {
  if (before === undefined) delete process.env.TWITCH_EVENTSUB_SECRET;
  else process.env.TWITCH_EVENTSUB_SECRET = before;
}
console.log("EventSub signature preflight passed: exact HMAC bytes, replay window, raw-stream limits, account identifiers and challenge/revocation validation (no ingestion enabled).");
