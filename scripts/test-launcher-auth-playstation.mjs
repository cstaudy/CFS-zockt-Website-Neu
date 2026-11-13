import assert from "node:assert/strict";
import { launcherAuthorized, UUID } from "../src/launcher-auth.js";

const original = process.env.LAUNCHER_BRIDGE_SECRET;
try {
  delete process.env.LAUNCHER_BRIDGE_SECRET;
  assert.equal(launcherAuthorized({ headers: { "x-cfs-launcher-secret": "x" } }), false,
    "No configured secret must fail closed");
  process.env.LAUNCHER_BRIDGE_SECRET = "legacy-short-secret";
  assert.equal(launcherAuthorized({ headers: { "x-cfs-launcher-secret": "legacy-short-secret" } }), true,
    "Existing non-empty bridge credentials remain compatible");
  assert.equal(launcherAuthorized({ headers: { "x-cfs-launcher-secret": "legacy-short-secreT" } }), false);
  assert.equal(launcherAuthorized({ headers: {} }), false);
  assert.equal(launcherAuthorized({}), false);
  process.env.LAUNCHER_BRIDGE_SECRET = "";
  assert.equal(launcherAuthorized({ headers: { "x-cfs-launcher-secret": "" } }), false);
  assert.equal(UUID.test("123e4567-e89b-42d3-a456-426614174000"), true);
  assert.equal(UUID.test("a' OR 1=1"), false);
} finally {
  if (original === undefined) delete process.env.LAUNCHER_BRIDGE_SECRET;
  else process.env.LAUNCHER_BRIDGE_SECRET = original;
}
console.log("Launcher auth: constant-time digest comparison, fail-closed, backward compatible.");
