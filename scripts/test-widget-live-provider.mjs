import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { publicWidgetPayload, applyTwitchWidgetState } from "../src/widget-output.js";
import { twitchStreamForUserId } from "../src/public-twitch.js";

const id = "123e4567-e89b-42d3-a456-426614174000";
const startedAt = new Date(Date.now() - 120_000).toISOString();
const publishedRow = {
  id, status: "published", twitch_user_id: "101",
  data: {
    widget_type: "twitch_live_timer", secret: "PRIVATE_TOKEN_NEVER_PUBLIC",
    draft_config: {
      widgetType: "twitch_live_timer", elements: [{ type: "text", data: { text: "DRAFT_PRIVATE" } }]
    },
    published_config: {
      widgetType: "twitch_live_timer",
      canvas: { width: 620, height: 132 },
      settings: { offlineBehavior: "zero" },
      elements: [
        { id: "timer", type: "counter", data: { format: "{{timer}}" } },
        { id: "status", type: "text", data: { text: "{{status}}" } }
      ]
    }
  }
};
const timer = publicWidgetPayload(publishedRow);
assert.equal(timer.widget.definition.source_kind, "live_provider");
assert.equal(timer.widget.definition.mode, "timer");
assert.equal(timer.widget.definition.provider, "twitch");
assert.equal(timer.data.live.connected, undefined);
assert.equal(JSON.stringify(timer).includes("PRIVATE_TOKEN"), false);
assert.equal(JSON.stringify(timer).includes("DRAFT_PRIVATE"), false);
assert.equal(JSON.stringify(timer).includes("twitch_user_id"), false);

const manual = publicWidgetPayload({
  ...publishedRow,
  data: { published_config: { widgetType: "manual_counter", settings: { manualValue: 17 } } }
});
assert.equal(manual.widget.definition.mode, "manual_counter");
assert.equal(manual.widget.definition.provider, undefined);
assert.strictEqual(applyTwitchWidgetState(manual, { status: "live", started_at: startedAt }), manual,
  "Manual widgets cannot receive Twitch data");

const live = applyTwitchWidgetState(timer, { status: "live", started_at: startedAt });
assert.equal(live.data.live.connected, true);
assert.equal(live.data.live.stale, false);
assert.equal(live.data.live.status, "live");
assert.equal(live.data.live.provider, "twitch");
const unknown = applyTwitchWidgetState(timer, { status: "unknown" });
assert.equal(unknown.data.live.connected, false);
assert.equal(unknown.data.live.status, "unknown");
assert.equal(unknown.data.live.started_at, null);
const offline = applyTwitchWidgetState(timer, { status: "offline" });
assert.equal(offline.data.live.connected, false);
assert.equal(offline.data.live.status, "offline");
assert.equal(offline.data.live.started_at, null);
assert.equal(applyTwitchWidgetState(timer, {
  status: "live", started_at: "not-an-actual-date"
}).data.live.status, "unknown");

const rendererText = await readFile(new URL("../assets/js/cfs-widget-renderer.js", import.meta.url), "utf8");
const context = { module: { exports: {} }, Date, Math, Number, String };
runInNewContext(rendererText, context);
const renderer = context.module.exports;
const renderedLive = renderer.runtimeData(live);
assert.equal(renderedLive.offline, false);
assert.equal(renderedLive.status, "TWITCH LIVE");
assert(renderedLive.current >= 120 && renderedLive.current < 130,
  "The live timer must use the confirmed Twitch started_at timestamp");
assert.match(renderer.renderElements(timer.widget.config, renderedLive), /02:0[0-9]/);
const renderedUnknown = renderer.runtimeData(unknown);
assert.equal(renderedUnknown.current, 0);
assert.equal(renderedUnknown.offline, true);
assert.equal(renderedUnknown.status, "STATUS OFFEN");
assert.equal(renderer.runtimeData(offline).status, "TWITCH OFFLINE");

const previousFetch = globalThis.fetch;
const oldId = process.env.TWITCH_CLIENT_ID;
const oldSecret = process.env.TWITCH_CLIENT_SECRET;
process.env.TWITCH_CLIENT_ID = "ci-widget-client";
process.env.TWITCH_CLIENT_SECRET = "ci-widget-secret";
const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push(String(url));
  assert(options.signal, "Twitch calls must have a timeout");
  if (String(url).includes("/oauth2/token")) {
    return { ok: true, json: async () => ({ access_token: "ci-widget-token", expires_in: 300 }) };
  }
  if (String(url).includes("streams?user_id=101")) {
    return { ok: true, json: async () => ({ data: [{
      user_id: "101", type: "live", started_at: startedAt
    }] }) };
  }
  if (String(url).includes("streams?user_id=202")) {
    return { ok: true, json: async () => ({ data: [] }) };
  }
  if (String(url).includes("streams?user_id=303")) {
    return { ok: false, status: 502, json: async () => ({}) };
  }
  if (String(url).includes("streams?user_id=404")) {
    return { ok: true, json: async () => ({ data: [{
      user_id: "101", type: "live", started_at: startedAt
    }] }) };
  }
  throw new Error("Unexpected Twitch provider request: " + url);
};
try {
  assert.deepEqual(await twitchStreamForUserId("not-a-twitch-id"), { status: "unknown" });
  assert.equal(calls.length, 0, "Unknown account IDs must not invoke Twitch");
  const signal = await twitchStreamForUserId("101");
  assert.equal(signal.status, "live");
  assert.equal(signal.started_at, startedAt);
  const count = calls.length;
  assert.equal((await twitchStreamForUserId("101")).status, "live");
  assert.equal(calls.length, count, "Same creator Twitch state must be briefly cached");
  assert.equal((await twitchStreamForUserId("202")).status, "offline");
  assert.equal((await twitchStreamForUserId("303")).status, "unknown",
    "Provider outages cannot be misrepresented as confirmed OFFLINE");
  assert.equal((await twitchStreamForUserId("404")).status, "unknown",
    "One creator's live channel cannot be passed off as another creator's channel");
  assert(calls.some(url => url.includes("streams?user_id=101")));
  assert(calls.some(url => url.includes("streams?user_id=404")));
  assert(!calls.some(url => url.includes("users?login=")),
    "Owner-linked timer data must never fall back to the site's global channel");
} finally {
  globalThis.fetch = previousFetch;
  if (oldId === undefined) delete process.env.TWITCH_CLIENT_ID;
  else process.env.TWITCH_CLIENT_ID = oldId;
  if (oldSecret === undefined) delete process.env.TWITCH_CLIENT_SECRET;
  else process.env.TWITCH_CLIENT_SECRET = oldSecret;
}
console.log("Twitch OBS timer tests passed: linked owner source, no cross-channel fallback, live/offline/unknown and renderer.");
