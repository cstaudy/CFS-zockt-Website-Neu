import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join, basename } from "node:path";
import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";
import { uploadRoot } from "./upload-storage.js";
import { decodeUploadFilename } from "./upload-filename.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowed = /^video\/(mp4|webm|quicktime|x-matroska)$/;
const MAX_SIZE = 512 * 1024 * 1024;
const MAX_ITEMS = 500;
const clean = value => String(value || "video").replace(/[^a-z0-9._-]/gi, "-").slice(0, 120) || "video";
function view(row) {
  return { id: row.id, folder: row.folder, name: row.name, mime_type: row.mime_type,
    size: Number(row.size_bytes), duration_ms: row.duration_ms, metadata: row.metadata || {},
    url: `/assets/uploads/${row.storage_path}`, created_at: row.created_at, updated_at: row.updated_at };
}

export async function listUserMedia(req, folder) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const f = ["videos", "clips"].includes(folder) ? folder : null;
  const result = await getPool().query(
    `select id,folder,name,mime_type,size_bytes,storage_path,duration_ms,metadata,created_at,updated_at from user_media where account_id=$1${f ? " and folder=$2" : ""} order by created_at desc`,
    f ? [account.id, f] : [account.id]
  );
  return { ok: true, folder: f, media: result.rows.map(view),
    limits: { max_file_bytes: MAX_SIZE, max_items: MAX_ITEMS } };
}

export async function uploadUserMedia(req, body, folder) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!["videos", "clips"].includes(folder)) return { error: "INVALID_MEDIA_FOLDER", status: 400 };
  const mime = String(req.headers["content-type"] || "").split(";")[0];
  if (!allowed.test(mime)) return { error: "UNSUPPORTED_MEDIA_TYPE", status: 415 };
  if (!Buffer.isBuffer(body) || !body.length || body.length > MAX_SIZE)
    return { error: "INVALID_MEDIA_SIZE", status: 413 };
  const original = decodeUploadFilename(req.headers["x-cfs-file-name"], "video");
  if (original === null) return { error: "INVALID_FILE_NAME", status: 400 };
  const durationHeader = req.headers["x-cfs-duration-ms"];
  const duration = durationHeader === undefined ? null : Number(durationHeader);
  if (duration !== null && (!Number.isSafeInteger(duration) || duration < 0 || duration > 86400000))
    return { error: "INVALID_MEDIA_DURATION", status: 400 };

  const stored = `${account.id}-${randomUUID()}-${clean(original)}`;
  const client = await getPool().connect();
  let wroteFile = false;
  try {
    await client.query("BEGIN");
    // Serialize uploads per account to enforce the same limit under concurrency.
    const locked = await client.query("select id from accounts where id=$1 for update", [account.id]);
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      return { error: "AUTHENTICATION_REQUIRED", status: 401 };
    }
    const count = await client.query("select count(*)::int as count from user_media where account_id=$1", [account.id]);
    if (Number(count.rows[0]?.count || 0) >= MAX_ITEMS) {
      await client.query("ROLLBACK");
      return { error: "MEDIA_LIMIT_REACHED", status: 429 };
    }
    await mkdir(uploadRoot, { recursive: true });
    await writeFile(join(uploadRoot, stored), body, { flag: "wx" });
    wroteFile = true;
    const result = await client.query(
      "insert into user_media(account_id,folder,name,mime_type,size_bytes,storage_path,duration_ms,metadata) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb) returning id,folder,name,mime_type,size_bytes,storage_path,duration_ms,metadata,created_at,updated_at",
      [account.id, folder, clean(original), mime, body.length, stored, duration, JSON.stringify({source:"user_upload"})]
    );
    await client.query("COMMIT");
    return { ok: true, media: view(result.rows[0]) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (wroteFile) await unlink(join(uploadRoot, stored)).catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteUserMedia(req, id) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  if (!UUID.test(String(id))) return { error: "MEDIA_NOT_FOUND", status: 404 };
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "select id,storage_path from user_media where id=$1 and account_id=$2 for update",
      [id, account.id]
    );
    const media = found.rows[0];
    if (!media) {
      await client.query("ROLLBACK");
      return { error: "MEDIA_NOT_FOUND", status: 404 };
    }
    const stored = String(media.storage_path || "");
    // No path outside this creator's flat upload namespace may ever be unlinked.
    if (!stored.startsWith(account.id + "-") || basename(stored) !== stored ||
        stored.includes("/") || stored.includes("\\") || stored === "." || stored === "..") {
      await client.query("ROLLBACK");
      return { error: "INVALID_MEDIA_STORAGE_PATH", status: 409 };
    }
    await client.query("delete from user_media where id=$1 and account_id=$2", [id, account.id]);
    try {
      await unlink(join(uploadRoot, stored));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await client.query("COMMIT");
    return { ok: true, deleted: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
