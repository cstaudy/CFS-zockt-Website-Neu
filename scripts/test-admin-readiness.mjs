import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { adminReadiness } from "../src/admin-readiness.js";
import { ADMIN_EMAIL, accountAccessView, isAdminAccount } from "../src/admin-access.js";

assert.equal(isAdminAccount({ email: ADMIN_EMAIL, role: "creator", email_verified_at: new Date() }), false,
  "Matching email without provisioned admin role must not grant admin access");
assert.equal(isAdminAccount({ email: ADMIN_EMAIL, role: "admin", email_verified_at: null }), false,
  "Unverified admin email must not grant admin access");
assert.equal(isAdminAccount({ email: ADMIN_EMAIL, role: "admin", email_verified_at: new Date() }), true,
  "Only provisioned and verified admin account may receive admin access");
assert.equal(isAdminAccount({ email: "other@example.test", role: "admin", email_verified_at: new Date() }), false,
  "Admin role on another email must not grant configured operator access");
const adminInput = { id: "account-1", email: ADMIN_EMAIL, role: "admin", email_verified_at: new Date(), password_hash: "must-not-leak" };
const adminView = accountAccessView(adminInput);
assert.equal(adminView.role, "admin");
assert.equal(adminView.admin, true);
assert.equal(adminView.email_verified, true);
assert.equal(adminView.email_verified_at, adminInput.email_verified_at);
assert.equal(Object.hasOwn(adminView, "password_hash"), false, "admin projection must not leak password hashes");

function fakeClient({ matches, role_ready, email_ready }) {
  return { async query(sql, params) {
    assert.match(sql, /select count\(\*\)::int as matches/);
    assert.deepEqual(params, [ADMIN_EMAIL]);
    return { rows: [{ matches, role_ready, email_ready }] };
  } };
}
for (const values of [
  { matches: 0, role_ready: false, email_ready: false },
  { matches: 1, role_ready: false, email_ready: false },
  { matches: 1, role_ready: true, email_ready: false },
  { matches: 1, role_ready: false, email_ready: true },
  { matches: 2, role_ready: true, email_ready: true }
]) {
  const state = await adminReadiness(fakeClient(values));
  assert.equal(state.ready, false, "Unready or duplicate operator account must fail closed");
  assert.equal(Object.hasOwn(state, "email"), false, "Do not return account PII");
}
const valid = await adminReadiness(fakeClient({
  matches: 1, role_ready: true, email_ready: true
}));
assert.deepEqual(valid, {
  account_exists: true, role_ready: true, email_ready: true, ready: true
});
await assert.rejects(adminReadiness({ async query() { return { rows: [] }; } }),
  /ADMIN_PREFLIGHT_UNAVAILABLE/);
const blocked = spawnSync(process.execPath, ["scripts/check-admin-readiness.mjs"], {
  env: { ...process.env, CONFIRM_ADMIN_PREFLIGHT_READ_ONLY: "no", DATABASE_URL: "" },
  encoding: "utf8"
});
assert.notEqual(blocked.status, 0);
assert.match(blocked.stderr, /CONFIRM_ADMIN_PREFLIGHT_READ_ONLY=yes/);
console.log("Admin preflight: read-only query, no PII, fail-closed readiness and opt-in guard passed.");
