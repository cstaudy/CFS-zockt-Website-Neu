import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";

const uploadRoot = fileURLToPath(new URL("../assets/uploads/", import.meta.url));
const categories = { image: "Bilder", overlay: "Overlays", frame_overlay: "Rahmen", background: "Hintergründe" };

function asset(row) {
  return { id: row.id, name: row.name, original_name: row.name, media_type: row.media_type, format: row.mime_type.split("/")[1] || "bin", mime_type: row.mime_type, size: Number(row.size_bytes), category: row.category, auto_category: row.category, has_alpha: row.mime_type === "image/png" || row.mime_type === "image/webp", url: `/assets/uploads/${row.storage_path}`, created_at: row.created_at, actions: [{ key: "add_image", label: "ALS BILD EINFÜGEN" }, { key: "add_overlay", label: "ALS OVERLAY EINFÜGEN" }] };
}

function cleanName(value) { return String(value || "upload").replace(/[^a-z0-9._-]/gi, "-").slice(0, 120) || "upload"; }

export async function listAssets(req) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const result = await getPool().query("select id, name, media_type, mime_type, size_bytes, storage_path, category, created_at from creator_assets where account_id = $1 order by created_at desc", [account.id]);
  const rows = result.rows.map(asset);
  return { assets: rows, categories, limits: { max_assets: 120, max_total_bytes: 128 * 1024 * 1024 }, usage: { count: rows.length, bytes: rows.reduce((sum, row) => sum + row.size, 0) } };
}

export async function uploadAsset(req, body) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };
  const mime = String(req.headers["content-type"] || "application/octet-stream").split(";")[0];
  if (!/^image\/(png|jpeg|webp|gif)$/.test(mime)) return { error: "UNSUPPORTED_MEDIA_TYPE", status: 415 };
  if (!body?.length || body.length > 16 * 1024 * 1024) return { error: "INVALID_ASSET_SIZE", status: 400 };
  const original = decodeURIComponent(String(req.headers["x-cfs-file-name"] || "upload"));
  const stored = `${randomUUID()}-${cleanName(original)}`;
  await mkdir(uploadRoot, { recursive: true });
  await writeFile(join(uploadRoot, stored), body, { flag: "wx" });
  const result = await getPool().query("insert into creator_assets (account_id, name, mime_type, size_bytes, storage_path) values ($1, $2, $3, $4, $5) returning id, name, media_type, mime_type, size_bytes, storage_path, category, created_at", [account.id, cleanName(original), mime, body.length, stored]);
  return { asset: asset(result.rows[0]) };
}
