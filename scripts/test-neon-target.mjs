import assert from "node:assert/strict";
import { inspectNeonTarget } from "../src/neon-target-check.js";

const base = {
  EXPECTED_NEON_HOST: "ep-production.eu-central-1.aws.neon.tech",
  EXPECTED_NEON_DATABASE: "cfs_zockt_production",
  DATABASE_URL: "postgresql://deploy-user:masked@ep-production.eu-central-1.aws.neon.tech/cfs_zockt_production?sslmode=verify-full&application_name=cfs-zockt",
  DATABASE_SSL: "true"
};
assert.deepEqual(inspectNeonTarget(base), {
  ok: true,
  code: "NEON_TARGET_VERIFIED",
  hostname: base.EXPECTED_NEON_HOST,
  database: base.EXPECTED_NEON_DATABASE
});
for (const [name, change, code] of [
  ["host", { DATABASE_URL: base.DATABASE_URL.replace("ep-production.eu-central-1.aws.neon.tech", "ep-other.eu-central-1.aws.neon.tech") }, "NEON_TARGET_HOST_MISMATCH"],
  ["database", { DATABASE_URL: base.DATABASE_URL.replace("cfs_zockt_production", "other_db") }, "NEON_TARGET_DATABASE_MISMATCH"],
  ["tls", { DATABASE_URL: base.DATABASE_URL.replace("sslmode=verify-full", "sslmode=require") }, "NEON_TLS_VERIFY_FULL_REQUIRED"],
  ["ssl flag", { DATABASE_SSL: "false" }, "NEON_TLS_DISABLED"],
  ["parameters", { DATABASE_URL: `${base.DATABASE_URL}&sslmode=require` }, "NEON_DATABASE_URL_PARAMETERS_INVALID"]
]) {
  assert.equal(inspectNeonTarget({ ...base, ...change }).code, code, `${name} must fail closed`);
}
const serialized = JSON.stringify(inspectNeonTarget(base));
assert(!serialized.includes("masked"), "target result must not echo credentials");
console.log("Neon target contract: exact host/database, verify-full, parameters and fail-closed checks passed.");
