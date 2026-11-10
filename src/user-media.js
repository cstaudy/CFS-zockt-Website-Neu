import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";

const root=fileURLToPath(new URL("../assets/uploads/",import.meta.url));
const allowed=/^video\/(mp4|webm|quicktime|x-matroska)$/;
const clean=v=>String(v||"video").replace(/[^a-z0-9._-]/gi,"-").slice(0,120)||"video";
function view(row){return{id:row.id,folder:row.folder,name:row.name,mime_type:row.mime_type,size:Number(row.size_bytes),duration_ms:row.duration_ms,metadata:row.metadata||{},url:`/assets/uploads/${row.storage_path}`,created_at:row.created_at,updated_at:row.updated_at};}
export async function listUserMedia(req,folder){const a=await requireAccount(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};const f=["videos","clips"].includes(folder)?folder:null;const r=await getPool().query(`select id,folder,name,mime_type,size_bytes,storage_path,duration_ms,metadata,created_at,updated_at from user_media where account_id=$1${f?" and folder=$2":""} order by created_at desc`,f?[a.id,f]:[a.id]);return{ok:true,folder:f,media:r.rows.map(view),limits:{max_file_bytes:512*1024*1024,max_items:500}};}
export async function uploadUserMedia(req,body,folder){const a=await requireAccount(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};if(!["videos","clips"].includes(folder))return{error:"INVALID_MEDIA_FOLDER",status:400};const mime=String(req.headers["content-type"]||"").split(";")[0];if(!allowed.test(mime))return{error:"UNSUPPORTED_MEDIA_TYPE",status:415};if(!body?.length||body.length>512*1024*1024)return{error:"INVALID_MEDIA_SIZE",status:413};const original=decodeURIComponent(String(req.headers["x-cfs-file-name"]||"video"));const stored=`${a.id}-${randomUUID()}-${clean(original)}`;await mkdir(root,{recursive:true});await writeFile(join(root,stored),body,{flag:"wx"});const r=await getPool().query("insert into user_media(account_id,folder,name,mime_type,size_bytes,storage_path,duration_ms,metadata) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb) returning id,folder,name,mime_type,size_bytes,storage_path,duration_ms,metadata,created_at,updated_at",[a.id,folder,clean(original),mime,body.length,stored,Number(req.headers["x-cfs-duration-ms"])||null,JSON.stringify({source:"user_upload"})]);return{ok:true,media:view(r.rows[0])};}
export async function deleteUserMedia(req,id){const a=await requireAccount(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};const r=await getPool().query("delete from user_media where id=$1 and account_id=$2 returning id",[id,a.id]);return r.rowCount?{ok:true,deleted:true}:{error:"MEDIA_NOT_FOUND",status:404};}

