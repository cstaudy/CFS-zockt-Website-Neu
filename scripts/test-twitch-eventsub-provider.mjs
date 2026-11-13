import assert from "node:assert/strict";
import { deleteRemoteFollowSubscription } from "../src/twitch-eventsub-provider.js";
import { disableTwitchFollowForAccount } from "../src/twitch-follow-subscriptions.js";

const id = "123e4567-e89b-42d3-a456-426614174001";
const accountId = "123e4567-e89b-42d3-a456-426614174002";
const previous = {
  fetch: globalThis.fetch,
  clientId: process.env.TWITCH_CLIENT_ID,
  clientSecret: process.env.TWITCH_CLIENT_SECRET
};
async function scenario({ deleteStatus = 204, tokenStatus = 200, deleteNetworkError = false } = {}) {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), method: options.method, options });
    assert(options.signal, "Twitch API requests must be time-bounded");
    if (String(url).includes("/oauth2/token")) return {
      ok: tokenStatus === 200, status: tokenStatus,
      json: async () => ({ access_token: "ci-app-access-token" })
    };
    if (String(url).includes("/eventsub/subscriptions")) {
      if (deleteNetworkError) throw new Error("Provider disconnected");
      assert.equal(options.method, "DELETE");
      assert.equal(options.headers["Client-Id"], "ci-client-id");
      assert.equal(options.headers.Authorization, "Bearer ci-app-access-token");
      return { status: deleteStatus, ok: deleteStatus >= 200 && deleteStatus < 300 };
    }
    throw new Error("Unexpected Twitch API request " + url);
  };
  return requests;
}
function fakeClient(subscriptionId = id) {
  const calls = [];
  return {
    calls,
    async query(sql, args = []) {
      calls.push({ sql, args });
      if (sql.startsWith("select subscription_id from twitch_follow_subscriptions"))
        return { rows: subscriptionId ? [{ subscription_id: subscriptionId }] : [] };
      return { rows: [], rowCount: 1 };
    }
  };
}
try {
  delete process.env.TWITCH_CLIENT_ID;
  delete process.env.TWITCH_CLIENT_SECRET;
  assert.deepEqual(await deleteRemoteFollowSubscription(id), {
    deleted: false, reason: "provider_not_configured"
  });
  assert.deepEqual(await deleteRemoteFollowSubscription("unsafe-id"), {
    deleted: false, reason: "invalid_subscription"
  });
  const withoutConfig = fakeClient();
  const disabledWithoutProvider = await disableTwitchFollowForAccount(withoutConfig, accountId);
  assert.equal(disabledWithoutProvider.disabled, true);
  assert.equal(disabledWithoutProvider.cleanup_pending, true);
  assert(withoutConfig.calls.some(item => item.sql.startsWith("delete from twitch_follow_events")));
  assert(withoutConfig.calls.some(item => item.sql.startsWith("update twitch_follow_subscriptions")));
  assert(!withoutConfig.calls.some(item => item.sql.startsWith("delete from twitch_follow_subscriptions")),
    "An unreachable Twitch deletion cannot discard its retry identifier");

  process.env.TWITCH_CLIENT_ID = "ci-client-id";
  process.env.TWITCH_CLIENT_SECRET = "ci-client-secret";
  const success = await scenario();
  assert.deepEqual(await deleteRemoteFollowSubscription(id), { deleted: true });
  assert(success.some(item => item.url.endsWith("eventsub/subscriptions?id=" + id)));
  const deleted = fakeClient();
  const result = await disableTwitchFollowForAccount(deleted, accountId);
  assert.equal(result.provider_deleted, true);
  assert.equal(result.cleanup_pending, false);
  assert(deleted.calls.some(item => item.sql.startsWith("delete from twitch_follow_subscriptions")));
  assert(deleted.calls.some(item => item.sql.startsWith("delete from twitch_follow_challenges")));

  await scenario({ deleteStatus: 404 });
  assert.deepEqual(await deleteRemoteFollowSubscription(id), { deleted: true },
    "A previously deleted Twitch subscription must be safe to retry");
  const alreadyGone = fakeClient();
  assert.equal((await disableTwitchFollowForAccount(alreadyGone, accountId)).cleanup_pending, false);
  await scenario({ deleteStatus: 500 });
  assert.equal((await deleteRemoteFollowSubscription(id)).deleted, false);
  const failed = fakeClient();
  assert.equal((await disableTwitchFollowForAccount(failed, accountId)).cleanup_pending, true);
  assert(!failed.calls.some(item => item.sql.startsWith("delete from twitch_follow_subscriptions")));
  await scenario({ tokenStatus: 401 });
  assert.deepEqual(await deleteRemoteFollowSubscription(id), {
    deleted: false, reason: "provider_auth_failed"
  });
  await scenario({ deleteNetworkError: true });
  assert.deepEqual(await deleteRemoteFollowSubscription(id), {
    deleted: false, reason: "provider_unavailable"
  });
  const noSubscription = fakeClient(null);
  const noSubscriptionResult = await disableTwitchFollowForAccount(noSubscription, accountId);
  assert.equal(noSubscriptionResult.disabled, true);
  assert.equal(noSubscriptionResult.cleanup_pending, false);
  assert(noSubscription.calls.some(item => item.sql.startsWith("delete from twitch_follow_events")));
} finally {
  globalThis.fetch = previous.fetch;
  if (previous.clientId === undefined) delete process.env.TWITCH_CLIENT_ID;
  else process.env.TWITCH_CLIENT_ID = previous.clientId;
  if (previous.clientSecret === undefined) delete process.env.TWITCH_CLIENT_SECRET;
  else process.env.TWITCH_CLIENT_SECRET = previous.clientSecret;
}
console.log("Twitch EventSub remote cleanup passed: 204/404, outage, retry, local revocation and idempotence.");
