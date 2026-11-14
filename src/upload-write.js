import { mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { uploadRoot } from "./upload-storage.js";

// The application generates opaque UUID-based names; this guard also ensures
// a future caller cannot turn the helper into an arbitrary-path file writer.
const STORAGE_LEAF = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}\.[a-z0-9]{1,8}$/;

/**
 * Persist upload bytes and then register their database metadata.
 *
 * If registration rejects, delete only the file this invocation successfully
 * created (never an existing file). Filesystem and PostgreSQL cannot form one
 * atomic transaction: cleanup is best-effort and must not mask the original
 * registration failure. A cleanup failure is signalled without logging names,
 * paths or bytes, so an operator can investigate orphaned storage.
 */
export async function storeUploadWithRecord(stored, bytes, register, root = uploadRoot) {
  if (typeof stored !== "string" || !STORAGE_LEAF.test(stored) ||
      !Buffer.isBuffer(bytes) || typeof register !== "function") {
    throw new TypeError("INVALID_UPLOAD_STORAGE_REQUEST");
  }

  await mkdir(root, { recursive: true });
  const path = join(root, stored);
  // Crucially, this is outside the cleanup catch. If wx fails because a
  // filename exists, NEVER delete the pre-existing file.
  const handle = await open(path, "wx", 0o600);
  try {
    try {
      await handle.writeFile(bytes);
    } finally {
      await handle.close();
    }
    return await register();
  } catch (error) {
    try {
      await unlink(path);
    } catch (cleanupError) {
      console.error("upload_orphan_cleanup_failed", cleanupError?.code || "UNKNOWN");
    }
    throw error;
  }
}
