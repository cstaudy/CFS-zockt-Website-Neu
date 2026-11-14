import assert from "node:assert/strict";
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isOwnedMediaStorageName, removeDeletedMediaFile
} from "../src/media-file-cleanup.js";

const owner = "123e4567-e89b-42d3-a456-426614174000";
const other = "123e4567-e89b-42d3-a456-426614174009";
const uuid = "123e4567-e89b-42d3-a456-426614174123";
const current = owner + "-" + uuid + ".mp4";
const legacy = owner + "-" + uuid + "-my-old-video.html";
const foreign = other + "-" + uuid + ".webm";

for (const name of [current, legacy, owner + "-" + uuid + ".mov",
  owner + "-" + uuid + ".mkv", owner + "-" + uuid + ".webm"]) {
  assert.equal(isOwnedMediaStorageName(name, owner), true,
    "Only storage names generated for this owner are eligible");
}
for (const name of [foreign, uuid + ".mp4", owner + "-../foreign.mp4",
  owner + "-" + uuid + ".html", owner + "-" + uuid + ".svg",
  "../outside.mp4", "/tmp/sensitive.mp4", owner + "-" + uuid + "/x.mp4",
  owner + "-" + uuid + "-" + "x".repeat(121), "", null, {}, 12]) {
  assert.equal(isOwnedMediaStorageName(name, owner), false,
    "Foreign, active-document, malformed and traversal names cannot be deleted");
}
assert.equal(isOwnedMediaStorageName(current, other), false);

const root = await mkdtemp(join(tmpdir(), "cfs-deleted-media-test-"));
try {
  const data = Buffer.from("isolated-video-test-payload");
  await writeFile(join(root, current), data);
  await writeFile(join(root, legacy), data);
  await writeFile(join(root, foreign), data);
  const denied = await removeDeletedMediaFile(foreign, owner, () => {
    throw new Error("Must not check references for another owner's path");
  }, root);
  assert.equal(denied, "unrecognized");
  assert.deepEqual(await readFile(join(root, foreign)), data);

  let checked = 0;
  const shared = await removeDeletedMediaFile(current, owner, async () => {
    checked++;
    return true;
  }, root);
  assert.equal(shared, "referenced");
  assert.equal(checked, 1);
  assert.deepEqual(await readFile(join(root, current)), data,
    "A second database record for this path must block physical deletion");

  const referenceFailure = new Error("synthetic database outage");
  await assert.rejects(removeDeletedMediaFile(current, owner, () => {
    throw referenceFailure;
  }, root), e => e === referenceFailure);
  assert.deepEqual(await readFile(join(root, current)), data,
    "A failed reference query must leave bytes intact");

  assert.equal(await removeDeletedMediaFile(current, owner, async () => false, root),
    "removed", "Unreferenced owner file should be unlinked after metadata DELETE");
  await assert.rejects(access(join(root, current)), { code: "ENOENT" });
  assert.equal(await removeDeletedMediaFile(current, owner, async () => false, root),
    "missing", "Missing files must be an idempotent successful cleanup");

  assert.equal(await removeDeletedMediaFile(legacy, owner, async () => false, root),
    "removed", "Previous filename format should be cleaned on authorized DELETE");
  assert.deepEqual(await readdir(root), [foreign],
    "No unrelated or foreign media bytes should be removed");
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log("Media deletion: strict owner/path checks, reference isolation, safe unlink and idempotent missing files.");
