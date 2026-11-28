import assert from "node:assert/strict";
import { buildProviderCapabilities, readProviderCapabilities } from "../src/provider-capabilities.js";
const now = Date.parse("2026-11-28T12:00:00Z");
const configured = { tiktok: true, twitch: true, youtube: true };
const empty = buildProviderCapabilities([], configured, now);
assert.equal(empty.length, 7);
assert.equal(new Set(empty.map(p => p.provider)).size, 7);
assert.equal(empty.find(p => p.provider === "tiktok").connection, "not_connected");
assert.equal(empty.find(p => p.provider === "youtube").configured, false);
const rows = [
  { provider: "tiktok", scope: "user.info.basic,video.list video.upload,video.publish", expires_at: "2026-11-29T12:00:00Z", access_token: "never-emit-token", open_id: "never-emit-id" },
  { provider: "twitch", scope: "user:read:email channel:read:stream_key", expires_at: "2026-11-28T12:00:00Z", email: "never-emit-email" }
];
const all = buildProviderCapabilities(rows, configured, now);
const tt = all.find(p => p.provider === "tiktok"), tw = all.find(p => p.provider === "twitch");
assert.equal(tt.connection, "record_present");
assert.equal(tt.token_status, "not_expired_unverified");
assert.equal(tt.read.scope_recorded, true);
assert.equal(tt.publishing.upload_scope_recorded, true);
assert.equal(tt.publishing.publish_scope_recorded, true);
assert.equal(tt.publishing.status, "planned");
assert.equal(tw.token_status, "expired");
assert.equal(tw.live.scope_recorded, true);
assert.equal(tw.publishing.status, "not_supported");
assert(all.every(p => !p.live.ready && !p.publishing.ready && !p.read.verified));
assert.doesNotMatch(JSON.stringify(all), /never-emit|channel:read:stream_key|video\.publish/);
const partial = buildProviderCapabilities([{provider:"tiktok",scope:"video.publish.extra",expires_at:null}], {}, now)[0];
assert.equal(partial.token_status, "expiry_unknown");
assert.equal(partial.publishing.publish_scope_recorded, false);
assert.equal(partial.configured, false);
for (const invalid of [null, [null], [{provider:"youtube"}], [rows[0], rows[0]]])
  assert.throws(() => buildProviderCapabilities(invalid, configured, now), /INVALID_PROVIDER_METADATA/);
const calls = [];
const db = { async query(sql, values) { calls.push({sql, values}); return {rows: []}; } };
await readProviderCapabilities(db, "account-a", configured, now);
assert.equal(calls.length, 1);
assert.deepEqual(calls[0].values, ["account-a"]);
assert.equal((calls[0].sql.match(/where account_id=\$1/g)||[]).length, 2);
assert.match(calls[0].sql, /^select /i);
assert.doesNotMatch(calls[0].sql, /access_token|refresh_token|open_id|email|insert|update|delete/i);
await assert.rejects(readProviderCapabilities(db, "", configured, now), /PROVIDER_ACCOUNT_REQUIRED/);
assert.equal(calls.length, 1);
console.log("Provider capabilities: account-scoped metadata, exact scope checks, expiry, no secret projection and fail-closed publishing.");
