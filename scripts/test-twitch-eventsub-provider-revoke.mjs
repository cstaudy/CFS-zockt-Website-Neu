import assert from "node:assert/strict";
import { deleteRemoteFollowSubscription } from "../src/twitch-eventsub-provider.js";

const id = "123e4567-e89b-42d3-a456-426614174001";
const original = {
  fetch: globalThis.fetch,
  clientId: process.env.TWITCH_CLIENT_ID,
  clientSecret: process.env.TWITCH_CLIENT_SECRET
};
function mockProvider({ authStatus = 200, deleteStatus = 204,
  failure = null, invalidToken = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), method: options?.method, headers: options?.headers });
    assert(options?.signal, "Every network request must be time-bounded");
    if (String(url) === "https://id.twitch.tv/oauth2/token") {
      assert.equal(options.method, "POST");
      assert.equal(options.headers["content-type"], "application/x-www-form-urlencoded");
      const form = new URLSearchParams(options.body);
      assert.equal(form.get("client_id"), "ci-client-id");
      assert.equal(form.get("client_secret"), "ci-application-secret");
      assert.equal(form.get("grant_type"), "client_credentials",
        "Webhook deletion must use an app access token");
      if (failure === "oauth") throw new Error("OAuth unavailable");
      return {
        ok: authStatus === 200, status: authStatus,
        json: async () => invalidToken ? { access_token: "" } :
          { access_token: "ci-app-token" }
      };
    }
    if (String(url) === "https://api.twitch.tv/helix/eventsub/subscriptions?id=" + id) {
      assert.equal(options.method, "DELETE");
      assert.equal(options.headers.Authorization, "Bearer ci-app-token");
      assert.equal(options.headers["Client-Id"], "ci-client-id");
      if (failure === "delete") throw new Error("Twitch unavailable");
      return { status: deleteStatus, ok: deleteStatus >= 200 && deleteStatus < 300 };
    }
    throw new Error("Unexpected endpoint " + url);
  };
  return calls;
}
try {
  delete process.env.TWITCH_CLIENT_ID;
  delete process.env.TWITCH_CLIENT_SECRET;
  const none = mockProvider();
  assert.deepEqual(await deleteRemoteFollowSubscription("not-a-uuid"),
    { deleted: false, reason: "invalid_subscription" });
  assert.deepEqual(await deleteRemoteFollowSubscription(id),
    { deleted: false, reason: "provider_not_configured" });
  assert.equal(none.length, 0, "Invalid or unconfigured requests must not reach Twitch");

  process.env.TWITCH_CLIENT_ID = "ci-client-id";
  process.env.TWITCH_CLIENT_SECRET = "ci-application-secret";
  const success = mockProvider();
  assert.deepEqual(await deleteRemoteFollowSubscription(id), { deleted: true });
  assert.deepEqual(success.map(x => x.method), ["POST", "DELETE"],
    "Only app auth and one fixed-domain delete should occur");

  const missing = mockProvider({ deleteStatus: 404 });
  assert.deepEqual(await deleteRemoteFollowSubscription(id), {
    deleted: false, reason: "provider_not_found_or_not_owned"
  }, "404 must not falsely prove deletion of a subscription from another app");
  assert.equal(missing.length, 2);
  const serverFailed = mockProvider({ deleteStatus: 500 });
  assert.deepEqual(await deleteRemoteFollowSubscription(id),
    { deleted: false, reason: "provider_delete_failed" });
  const unauthorizedDelete = mockProvider({ deleteStatus: 401 });
  assert.equal((await deleteRemoteFollowSubscription(id)).deleted, false,
    "Unauthorized provider request must not mark cleanup completed");
  mockProvider({ authStatus: 401 });
  assert.deepEqual(await deleteRemoteFollowSubscription(id),
    { deleted: false, reason: "provider_auth_failed" });
  mockProvider({ invalidToken: true });
  assert.deepEqual(await deleteRemoteFollowSubscription(id),
    { deleted: false, reason: "provider_auth_failed" });
  mockProvider({ failure: "oauth" });
  assert.deepEqual(await deleteRemoteFollowSubscription(id),
    { deleted: false, reason: "provider_unavailable" });
  mockProvider({ failure: "delete" });
  assert.deepEqual(await deleteRemoteFollowSubscription(id),
    { deleted: false, reason: "provider_unavailable" });

  const afterFailure = mockProvider({ deleteStatus: 204 });
  assert.deepEqual(await deleteRemoteFollowSubscription(id), { deleted: true },
    "Later retry can succeed when the Twitch provider is available");
  assert.equal(afterFailure.length, 2);
} finally {
  globalThis.fetch = original.fetch;
  if (original.clientId === undefined) delete process.env.TWITCH_CLIENT_ID;
  else process.env.TWITCH_CLIENT_ID = original.clientId;
  if (original.clientSecret === undefined) delete process.env.TWITCH_CLIENT_SECRET;
  else process.env.TWITCH_CLIENT_SECRET = original.clientSecret;
}
console.log("Twitch remote cleanup helper: app-token only, fixed endpoint, 204 success, 404 unconfirmed, timeout/auth/outage retry safety.");
