import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { storeUploadWithRecord } from "../src/upload-write.js";

const root = await mkdtemp(join(tmpdir(), "cfs-upload-atomic-test-"));
try {
  const bytes = Buffer.from("CI-ONLY-PRIVATE-BYTES");
  let observedFileDuringRegistration = false;
  const record = { id: "ci-test-record" };
  const result = await storeUploadWithRecord("valid-test.png", bytes, async () => {
    observedFileDuringRegistration = true;
    assert.deepEqual(await readFile(join(root, "valid-test.png")), bytes,
      "Metadata registration must see the newly written bytes");
    return record;
  }, root);
  assert.equal(observedFileDuringRegistration, true);
  assert.equal(result, record, "Successful registration must preserve its return value");
  assert.deepEqual(await readFile(join(root, "valid-test.png")), bytes,
    "A successful database registration must not delete the file");

  const rejected = new Error("CI simulated PostgreSQL constraint failure");
  let attempted = 0;
  await assert.rejects(
    storeUploadWithRecord("failed-test.mp4", bytes, async () => {
      attempted++;
      throw rejected;
    }, root),
    error => error === rejected,
    "Preserve the exact original database error"
  );
  assert.equal(attempted, 1);
  assert.deepEqual((await readdir(root)).sort(), ["valid-test.png"],
    "Failed metadata registration must remove only its own newly created file");

  // wx must refuse collisions BEFORE entering the compensation catch: otherwise
  // an untrusted repeated filename could delete an existing unrelated upload.
  await writeFile(join(root, "occupied.webp"), Buffer.from("PREEXISTING"));
  let registeredCollision = false;
  await assert.rejects(
    storeUploadWithRecord("occupied.webp", bytes, async () => {
      registeredCollision = true;
    }, root),
    { code: "EEXIST" }
  );
  assert.equal(registeredCollision, false);
  assert.deepEqual(await readFile(join(root, "occupied.webp")),
    Buffer.from("PREEXISTING"), "Never touch or unlink a pre-existing collision");

  for (const name of ["../outside.mp4", "nested/asset.png", "bad.html/other.png",
    ".hidden.png", "a..png", "storage.png?force", ""]) {
    await assert.rejects(
      storeUploadWithRecord(name, bytes, async () => {}, root),
      { message: "INVALID_UPLOAD_STORAGE_REQUEST" }
    );
  }
  assert.deepEqual((await readdir(root)).sort(), ["occupied.webp", "valid-test.png"],
    "Invalid names must not write to disk or call registration");
  await assert.rejects(
    storeUploadWithRecord("invalid.png", "not-bytes", async () => {}, root),
    { message: "INVALID_UPLOAD_STORAGE_REQUEST" }
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log("Upload compensation: successful writes persist; DB failure removes orphan; wx collision cannot delete previous files.");
