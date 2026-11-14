import { randomUUID } from "node:crypto";
import { storeUploadWithRecord } from "./upload-write.js";
import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";
import { decodeUploadFilename } from "./upload-filename.js";
import { uploadStorageExtension, validVideoSignature } from "./upload-media-policy.js";
import { maxBufferedUploadBytes } from "./request-raw.js";
import { parseUploadDurationMs } from "./media-duration.js";
import { removeDeletedMediaFile } from "./media-file-cleanup.js";

const allowed=/^video\/(mp4|webm|quicktime|x-matroska)$/;
const clean=v=>String(v||"video").replace(/[^a-z0-9._-]/gi,"-").slice(0,120)||"video";
function view(row){return{id:row.id,folder:row.folder,name:row.name,mime_type:row.mime_type,size:Number(row.size_bytes),duration_ms:row.duration_ms,metadata:row.metadata||{},url:`/assets/uploads/${row.storage_path}`,created_at:row.created_at,updated_at:row.updated_at};}
export async function listUserMedia(req,folder){const a=await requireAccount(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};const f=["videos","clips"].includes(folder)?folder:null;const r=await getPool().query(`select id,folder,name,mime_type,size_bytes,storage_path,duration_ms,metadata,created_at,updated_at from user_media where account_id=$1${f?" and folder=$2":""} order by created_at desc`,f?[a.id,f]:[a.id]);return{ok:true,folder:f,media:r.rows.map(view),limits:{max_file_bytes:maxBufferedUploadBytes,max_items:500}};}
export async function uploadUserMedia(req,body,folder){const a=await requireAccount(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};if(!["videos","clips"].includes(folder))return{error:"INVALID_MEDIA_FOLDER",status:400};const mime=String(req.headers["content-type"]||"").split(";")[0];if(!allowed.test(mime))return{error:"UNSUPPORTED_MEDIA_TYPE",status:415};if(!body?.length||body.length>maxBufferedUploadBytes)return{error:"INVALID_MEDIA_SIZE",status:413};if(!validVideoSignature(mime,body))return{error:"INVALID_MEDIA_SIGNATURE",status:415};const durationMs=parseUploadDurationMs(req.headers["x-cfs-duration-ms"]);if(durationMs===undefined)return{error:"INVALID_MEDIA_DURATION",status:400};const original=decodeUploadFilename(req.headers["x-cfs-file-name"], "video");if(original===null)return{error:"INVALID_FILE_NAME",status:400};const stored=`${a.id}-${randomUUID()}${uploadStorageExtension(mime)}`;const r=await storeUploadWithRecord(stored,body,()=>getPool().query("insert into user_media(account_id,folder,name,mime_type,size_bytes,storage_path,duration_ms,metadata) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb) returning id,folder,name,mime_type,size_bytes,storage_path,duration_ms,metadata,created_at,updated_at",[a.id,folder,clean(original),mime,body.length,stored,durationMs,JSON.stringify({source:"user_upload"})]));return{ok:true,media:view(r.rows[0])};}
export async function deleteUserMedia(req, id) {
  const account = await requireAccount(req);
  if (!account) return { error: "AUTHENTICATION_REQUIRED", status: 401 };

  const pool = getPool();
  const removed = await pool.query(
    "delete from user_media where id=$1 and account_id=$2 returning storage_path",
    [id, account.id]
  );
  if (!removed.rowCount) return { error: "MEDIA_NOT_FOUND", status: 404 };

  // The owner-scoped DB delete takes effect first: revocation never depends on
  // the filesystem. Keep the bytes if ANY other row still references this path,
  // including one owned by a different account or a creator asset.
  try {
    await removeDeletedMediaFile(removed.rows[0]?.storage_path, account.id,
      async stored => {
        const remaining = await pool.query(
          "select (exists(select 1 from user_media where storage_path=$1) or " +
          "exists(select 1 from creator_assets where storage_path=$1)) as referenced",
          [stored]
        );
        // Missing/unexpected query results must fail closed: keep the file.
        return remaining.rows[0]?.referenced !== false;
      });
  } catch (error) {
    // PostgreSQL and disk cannot be atomically committed together; keep the
    // successful deletion response and log no filenames or account identifiers.
    console.error("media_delete_storage_cleanup_failed", error?.code || "UNKNOWN");
  }
  return { ok: true, deleted: true };
}
