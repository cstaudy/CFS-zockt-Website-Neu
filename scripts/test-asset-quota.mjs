import assert from "node:assert/strict";
import { assetQuota, assetQuotaViolation, registerAssetWithinQuota } from "../src/asset-quota.js";

assert.deepEqual(assetQuota, {
  max_assets: 120, max_total_bytes: 128 * 1024 * 1024
});
const max = assetQuota.max_total_bytes;
assert.equal(assetQuotaViolation(0, 0, 1), null);
for (const invalid of [-1, 1.5, NaN, Infinity, "1", null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
  assert.equal(assetQuotaViolation(0, 0, invalid), "INVALID_ASSET_SIZE");
}
assert.equal(assetQuotaViolation(119, max - 70, 70), null,
  "The last permitted asset fitting exactly into the byte cap is allowed");
assert.equal(assetQuotaViolation(119, max - 70, 71), "ASSET_STORAGE_LIMIT_REACHED");
assert.equal(assetQuotaViolation(120, 0, 1), "ASSET_LIMIT_REACHED");
assert.equal(assetQuotaViolation(121, 0, 1), "ASSET_LIMIT_REACHED");
assert.equal(assetQuotaViolation("119", String(max - 1), 2), "ASSET_STORAGE_LIMIT_REACHED",
  "Parse exact PostgreSQL count/byte strings without floating point rounding");
assert.equal(assetQuotaViolation(5, "9007199254740993", 1), "ASSET_STORAGE_LIMIT_REACHED",
  "Potential corrupted huge usage values must fail closed");

function fakePool({ count = 0, bytes = 0, owner = true, insertError = null } = {}) {
  const queries = [];
  let released = false;
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return {};
      if (sql.includes("from accounts where id=$1 for update")) {
        return { rowCount: owner ? 1 : 0 };
      }
      if (sql.includes("from creator_assets where account_id=$1")) {
        return { rows: [{ count, used_bytes: String(bytes) }] };
      }
      if (sql.startsWith("insert into creator_assets")) {
        if (insertError) throw insertError;
        return { rows: [{ id: "ci-asset" }] };
      }
      throw new Error("Unexpected SQL in unit test: " + sql);
    },
    release() { released = true; }
  };
  return { queries, get released() { return released; }, async connect() { return client; } };
}
const fields = { name: "test.png", mime: "image/png", size: 100, stored: "test.png" };
for (const invalid of [-1, 1.5, NaN, Infinity, "1", null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
  const pool = fakePool();
  await assert.rejects(registerAssetWithinQuota(pool, "ci-account", { ...fields, size: invalid }),
    error => error.code === "INVALID_ASSET_SIZE" && error.status === 400);
  assert.deepEqual(pool.queries, [], "Malformed byte counts must not open a DB transaction");
}
const pass = fakePool({ count: 119, bytes: max - 100 });
const saved = await registerAssetWithinQuota(pass, "ci-account", fields);
assert.equal(saved.rows[0].id, "ci-asset");
assert.equal(pass.queries.at(-1), "COMMIT");
assert(pass.queries.some(q => q.includes("for update")),
  "The account row must be locked before count and insertion");
assert.equal(pass.released, true);

for (const [opts, expected] of [
  [{ count: 120 }, "ASSET_LIMIT_REACHED"],
  [{ count: 119, bytes: max - 99 }, "ASSET_STORAGE_LIMIT_REACHED"],
  [{ owner: false }, "AUTHENTICATION_REQUIRED"]
]) {
  const pool = fakePool(opts);
  await assert.rejects(registerAssetWithinQuota(pool, "ci-account", fields),
    error => error.code === expected,
    "Quota and missing accounts must fail before an asset INSERT");
  assert.equal(pool.queries.at(-1), "ROLLBACK");
  assert.equal(pool.queries.some(sql => sql.startsWith("insert into creator_assets")), false);
  assert.equal(pool.released, true);
}
const failed = fakePool({ insertError: new Error("synthetic database failure") });
await assert.rejects(registerAssetWithinQuota(failed, "ci-account", fields),
  /synthetic database failure/);
assert.equal(failed.queries.at(-1), "ROLLBACK");
assert.equal(failed.released, true);
console.log("Creator asset quota: count and byte caps, row-serialized INSERT, rollback and failure isolation.");
