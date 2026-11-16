import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mediaQuota, mediaQuotaViolation, registerMediaWithinQuota } from "../src/media-quota.js";
import { storeUploadWithRecord } from "../src/upload-write.js";

assert.deepEqual(mediaQuota, { max_items: 500 });
for (const count of [0, 1, 499, "499", 499n]) {
  assert.equal(mediaQuotaViolation(count), null);
}
for (const count of [500, 501, "500", 500n, "9007199254740993"]) {
  assert.equal(mediaQuotaViolation(count), "MEDIA_LIMIT_REACHED");
}
for (const count of [undefined, null, -1, 1.5, Infinity, NaN, "1.2", "-1", "",
  "false", {}, [], Number.MAX_SAFE_INTEGER + 1]) {
  assert.equal(mediaQuotaViolation(count), "MEDIA_QUOTA_UNAVAILABLE",
    "Ambiguous database counts must never create a new quota slot");
}

function fakePool({ count = "0", owner = true, insertError = null } = {}) {
  const queries = [];
  let released = false;
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return {};
      if (sql.includes("from accounts where id=$1 for update")) {
        return { rowCount: owner ? 1 : 0 };
      }
      if (sql.includes("from user_media where account_id=$1 and folder=$2")) {
        return { rows: [{ count }] };
      }
      if (sql.startsWith("insert into user_media")) {
        if (insertError) throw insertError;
        return { rows: [{ id: "ci-media" }] };
      }
      throw new Error("Unexpected SQL in media quota test: " + sql);
    },
    release() { released = true; }
  };
  return { queries, get released() { return released; },
    async connect() { return client; } };
}
const fields = {
  folder: "clips", name: "ci-test.mp4", mime: "video/mp4", size: 20,
  stored: "ci-file.mp4", durationMs: null,
  metadata: JSON.stringify({ source: "user_upload" })
};
for (const invalid of [-1, 0, 1.5, NaN, Infinity, "12", null, undefined,
  Number.MAX_SAFE_INTEGER + 1]) {
  const pool = fakePool();
  await assert.rejects(registerMediaWithinQuota(pool, "ci-owner",
    { ...fields, size: invalid }),
  error => error.code === "INVALID_MEDIA_SIZE" && error.status === 413);
  assert.deepEqual(pool.queries, [],
    "Invalid byte lengths must be rejected before opening a transaction");
}
const invalidFolder = fakePool();
await assert.rejects(registerMediaWithinQuota(invalidFolder, "ci-owner",
  { ...fields, folder: "../videos" }),
error => error.code === "INVALID_MEDIA_FOLDER" && error.status === 400);
assert.deepEqual(invalidFolder.queries, []);

const passing = fakePool({ count: "499" });
const saved = await registerMediaWithinQuota(passing, "ci-owner", fields);
assert.equal(saved.rows[0].id, "ci-media");
assert.equal(passing.queries.at(-1).sql, "COMMIT");
assert(passing.queries.some(q => q.sql.includes("for update")));
assert.equal(passing.queries.find(q => q.sql.includes("from user_media")).params[1], "clips");
assert(passing.queries.some(q => q.sql.startsWith("insert into user_media")),
  "Quota check must execute before INSERT in the same transaction");
assert.equal(passing.released, true);

for (const [opts, expected, status] of [
  [{ count: "500" }, "MEDIA_LIMIT_REACHED", 402],
  [{ count: "501" }, "MEDIA_LIMIT_REACHED", 402],
  [{ count: null }, "MEDIA_QUOTA_UNAVAILABLE", 503],
  [{ owner: false }, "AUTHENTICATION_REQUIRED", 401]
]) {
  const pool = fakePool(opts);
  await assert.rejects(registerMediaWithinQuota(pool, "ci-owner", fields),
    error => error.code === expected && error.status === status);
  assert.equal(pool.queries.at(-1).sql, "ROLLBACK");
  assert.equal(pool.queries.some(q => q.sql.startsWith("insert into user_media")), false);
  assert.equal(pool.released, true);
}
const failed = fakePool({ insertError: new Error("synthetic DB failure") });
await assert.rejects(registerMediaWithinQuota(failed, "ci-owner", fields),
  /synthetic DB failure/);
assert.equal(failed.queries.at(-1).sql, "ROLLBACK");
assert.equal(failed.released, true);

// A rejected metadata INSERT must not leave orphaned uploaded bytes.
const root = await mkdtemp(join(tmpdir(), "cfs-media-quota-"));
try {
  for (const count of ["500", "501"]) {
    const pool = fakePool({ count });
    await assert.rejects(
      storeUploadWithRecord("ci-quota.mp4", Buffer.from("test"),
        () => registerMediaWithinQuota(pool, "ci-owner", fields), root),
      error => error.code === "MEDIA_LIMIT_REACHED" && error.status === 402
    );
    assert.deepEqual(await readdir(root), []);
    assert.equal(pool.queries.at(-1).sql, "ROLLBACK");
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log("Creator media quota: folder limits, serial INSERT, rollback, malformed counts and cleanup.");
