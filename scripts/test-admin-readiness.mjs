import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { adminReadiness } from "../src/admin-readiness.js";
import { ADMIN_EMAIL } from "../src/admin-access.js";

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
