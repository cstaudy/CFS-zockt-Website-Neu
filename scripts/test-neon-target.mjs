import assert from "node:assert/strict";
import { inspectNeonTarget } from "../src/neon-target-check.js";
const host = "ep-example-pooler.eu-central-1.aws.neon.tech";
const base = { CFS_EXPECTED_NEON_HOST: host, CFS_EXPECTED_NEON_DATABASE: "creator_db",
  DATABASE_URL: `postgresql://creator:fake-secret@${host}/creator_db?sslmode=verify-full&channel_binding=require` };
const good = inspectNeonTarget(base);
assert.deepEqual(good, { ok: true, code: "NEON_CONFIGURED_TARGET_MATCH", tls_policy_requested: "verify-full" });
const cases = [
  [{ CFS_EXPECTED_NEON_HOST: undefined }, "NEON_EXPECTED_TARGET_REQUIRED"],
  [{ CFS_EXPECTED_NEON_HOST: "ep-example.neon.tech.evil.example" }, "NEON_EXPECTED_TARGET_REQUIRED"],
  [{ CFS_EXPECTED_NEON_DATABASE: "" }, "NEON_EXPECTED_TARGET_REQUIRED"],
  [{ DATABASE_URL: "" }, "NEON_DATABASE_URL_REQUIRED"],
  [{ DATABASE_URL: "invalid fake-secret" }, "NEON_DATABASE_URL_INVALID"],
  [{ DATABASE_URL: base.DATABASE_URL.replace("postgresql:", "https:") }, "NEON_DATABASE_URL_INVALID"],
  [{ DATABASE_URL: base.DATABASE_URL.replace(host, "ep-other.eu-central-1.aws.neon.tech") }, "NEON_TARGET_MISMATCH"],
  [{ DATABASE_URL: base.DATABASE_URL.replace("/creator_db", "/staging_db") }, "NEON_TARGET_MISMATCH"],
  [{ DATABASE_URL: base.DATABASE_URL + "&host=evil.example" }, "NEON_DATABASE_URL_AMBIGUOUS_PARAMETERS"],
  [{ DATABASE_URL: base.DATABASE_URL + "&dbname=other" }, "NEON_DATABASE_URL_AMBIGUOUS_PARAMETERS"],
  [{ DATABASE_URL: base.DATABASE_URL + "&sslmode=disable" }, "NEON_DATABASE_URL_AMBIGUOUS_PARAMETERS"],
  [{ DATABASE_URL: base.DATABASE_URL + "&uselibpqcompat=true" }, "NEON_DATABASE_URL_AMBIGUOUS_PARAMETERS"],
  [{ DATABASE_URL: base.DATABASE_URL.replace("verify-full", "require") }, "NEON_TLS_VERIFY_FULL_REQUIRED"],
  [{ DATABASE_SSL: "false" }, "NEON_TLS_VERIFY_FULL_REQUIRED"],
  [{ DATABASE_URL: base.DATABASE_URL.replace(host, host + ":1234") }, "NEON_DATABASE_URL_INVALID"],
  [{ DATABASE_URL: base.DATABASE_URL + "#secret" }, "NEON_DATABASE_URL_INVALID"],
  [{ DATABASE_URL: base.DATABASE_URL.replace("creator_db", "%ZZ") }, "NEON_DATABASE_URL_INVALID"]
];
for (const [changes, code] of cases) {
  const result = inspectNeonTarget({ ...base, ...changes });
  assert.deepEqual(result, { ok: false, code });
  assert(!JSON.stringify(result).includes("fake-secret"));
  assert(!JSON.stringify(result).includes(host));
}
assert(!JSON.stringify(good).includes(host));
console.log(`Neon target configuration: ${cases.length + 1} cases passed; no URL or credentials returned.`);
