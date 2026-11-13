import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { verifyEventSubMessage } from "../src/twitch-eventsub.js";
import { applyTwitchFollowWidgetState, publicWidgetPayload } from "../src/widget-output.js";

const secret = "ci-twitch-eventsub-local-secret-not-production-2026";
const now = Date.parse("2026-11-13T18:00:00.000Z");
const timestamp = new Date(now).toISOString();
const subscription = {
  id: "123e4567-e89b-42d3-a456-426614174001",
  type: "channel.follow", version: "2",
  condition: { broadcaster_user_id: "12345", moderator_user_id: "12345" }
};
const event = {
  broadcaster_user_id: "12345", user_id: "987",
  user_name: "<script>alert('unsafe')</script>",
  followed_at: new Date(now - 8000).toISOString()
};
function signed(payload, type = "notification", options = {}) {
  const bytes = Buffer.from(JSON.stringify(payload));
  const messageId = options.id || "follow-ci-123";
  const sent = options.timestamp || timestamp;
  const signature = "sha256=" + createHmac("sha256", secret)
    .update(messageId).update(sent).update(bytes).digest("hex");
  return {
    bytes, headers: {
      "twitch-eventsub-message-id": messageId,
      "twitch-eventsub-message-timestamp": sent,
      "twitch-eventsub-message-signature": signature,
      "twitch-eventsub-message-type": type,
      "twitch-eventsub-subscription-type": "channel.follow",
      "twitch-eventsub-subscription-version": "2"
    }
  };
}
const notification = signed({ subscription, event });
assert.equal(verifyEventSubMessage(notification.headers, notification.bytes, secret, now).type,
  "notification");
const wrongSignature = { ...notification.headers, "twitch-eventsub-message-signature": "sha256=" + "0".repeat(64) };
assert.equal(verifyEventSubMessage(wrongSignature, notification.bytes, secret, now).status, 403);
assert.equal(verifyEventSubMessage(notification.headers, Buffer.from("{}"), secret, now).status, 403,
  "Signing the headers but not the exact body must not authenticate a different event");
const old = signed({ subscription, event }, "notification", {
  timestamp: new Date(now - 11 * 60000).toISOString()
});
assert.equal(verifyEventSubMessage(old.headers, old.bytes, secret, now).status, 403,
  "Replayed old headers must be refused even if the signature is valid");
const future = signed({ subscription, event }, "notification", {
  timestamp: new Date(now + 11 * 60000).toISOString()
});
assert.equal(verifyEventSubMessage(future.headers, future.bytes, secret, now).status, 403);
assert.equal(verifyEventSubMessage(notification.headers, notification.bytes, "short", now).status, 503);
const badOwner = signed({ subscription, event: { ...event, broadcaster_user_id: "456" } });
assert.equal(verifyEventSubMessage(badOwner.headers, badOwner.bytes, secret, now).status, 400);
const badFollower = signed({ subscription, event: { ...event, user_id: "not-a-twitch-id" } });
assert.equal(verifyEventSubMessage(badFollower.headers, badFollower.bytes, secret, now).status, 400);
const invalidDate = signed({ subscription, event: { ...event, followed_at: "not-a-date" } });
assert.equal(verifyEventSubMessage(invalidDate.headers, invalidDate.bytes, secret, now).status, 400);
const verification = signed({ subscription, challenge: "challenge-ci-123" }, "webhook_callback_verification");
assert.equal(verifyEventSubMessage(verification.headers, verification.bytes, secret, now).payload.challenge,
  "challenge-ci-123");
const revoked = signed({ subscription, subscription_status: "authorization_revoked" }, "revocation");
assert.equal(verifyEventSubMessage(revoked.headers, revoked.bytes, secret, now).type, "revocation");

const widgetId = "123e4567-e89b-42d3-a456-426614174000";
function widget(type) {
  return publicWidgetPayload({
    id: widgetId, status: "published",
    data: { published_config: { widgetType: type, settings: { offlineBehavior: "zero" },
      elements: [
        { id: "status", type: "text", data: { text: "{{status}}" } },
        { id: "actor", type: "text", data: { text: "{{actor}}" } }
      ] } }
  });
}
const latest = widget("twitch_latest_follower");
const alert = widget("twitch_follow_alert");
assert.equal(latest.widget.definition.provider, "twitch_follow");
assert.equal(latest.widget.definition.mode, "latest");
assert.equal(alert.widget.definition.mode, "alert");
const savedEvent = { id: "123e4567-e89b-42d3-a456-426614174003",
  follower_name: event.user_name, followed_at: event.followed_at };
const verified = applyTwitchFollowWidgetState(latest, { status: "enabled", event: savedEvent }, now);
assert.equal(verified.events.length, 1);
assert.equal(verified.events[0].actor_name, event.user_name);
assert.equal(verified.events[0].event_type, "follow");
assert.equal(verified.data.live.connected, false, "Follow events do not prove a Twitch LIVE broadcast");
assert(!JSON.stringify(verified).includes("user_id"));
const none = applyTwitchFollowWidgetState(latest, { status: "pending", event: savedEvent }, now);
assert.deepEqual(none.events, []);
const emptyReady = applyTwitchFollowWidgetState(latest, { status: "enabled" }, now);
assert.deepEqual(emptyReady.events, []);
const freshAlert = applyTwitchFollowWidgetState(alert, { status: "enabled", event: savedEvent }, now);
assert.equal(freshAlert.events.length, 1);
const expiredAlert = applyTwitchFollowWidgetState(alert, { status: "enabled",
  event: { ...savedEvent, followed_at: new Date(now - 60000).toISOString() } }, now);
assert.deepEqual(expiredAlert.events, [], "Follow alerts must expire quickly and never repeat indefinitely");

const rendererSource = await readFile(new URL("../assets/js/cfs-widget-renderer.js", import.meta.url), "utf8");
const runtime = { module: { exports: {} }, Date, Math, Number, String };
runInNewContext(rendererSource, runtime);
const renderer = runtime.module.exports;
const runtimeEvent = renderer.runtimeData(verified);
assert.equal(runtimeEvent.actor, event.user_name);
assert.equal(runtimeEvent.status, "FOLLOW BESTÄTIGT");
assert.equal(renderer.runtimeData(none).actor, "—", "No follower should display an invented name");
assert.equal(renderer.runtimeData(none).status, "FOLLOW-SIGNAL OFFEN");
assert.equal(renderer.runtimeData(emptyReady).status, "BEREIT · WARTE AUF FOLLOW");
const html = renderer.renderElements(latest.widget.config, runtimeEvent);
assert(!html.includes("<script>"), "Follower names must be escaped in OBS HTML");
assert(html.includes("&lt;script&gt;"));
console.log("Twitch EventSub validation and follower widget projection: signature, replay window, expiry and escaping passed.");
