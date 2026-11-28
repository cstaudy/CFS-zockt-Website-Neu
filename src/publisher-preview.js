import { readProviderCapabilities } from "./provider-capabilities.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const profiles = Object.freeze({
  tiktok: {provider:"tiktok",format:"9:16",width:1080,height:1920},
  youtube_shorts: {provider:"youtube",format:"9:16",width:1080,height:1920},
  youtube_video: {provider:"youtube",format:"16:9",width:1920,height:1080},
  instagram_reels: {provider:"instagram",format:"9:16",width:1080,height:1920},
  facebook_reels: {provider:"facebook",format:"9:16",width:1080,height:1920}
});
const error = (code,status=400) => ({error:code,status});
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const onlyKeys = (value, keys) => object(value) && Object.keys(value).every(key=>keys.includes(key));
const validText = (value,max) => typeof value === "string" && value.length<=max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);

export function normalizePublisherPreview(body) {
  if (!onlyKeys(body,["media_id","targets","title","description","captions","brand_style"]) ||
      typeof body.media_id !== "string" || !UUID.test(body.media_id) ||
      !Array.isArray(body.targets) || body.targets.length<1 || body.targets.length>5 ||
      body.targets.some(id=>typeof id!=="string" || !Object.hasOwn(profiles,id)) ||
      new Set(body.targets).size!==body.targets.length ||
      !validText(body.title,100) || !body.title.trim() ||
      !validText(body.description??"",5000) ||
      typeof body.captions!=="boolean" ||
      !["none","clean","gaming"].includes(body.brand_style))
    return error("INVALID_PUBLISHER_PREVIEW");
  // Two YouTube profiles target the same currently planned account. Do not
  // silently create duplicate uploads to that account in a single request.
  if (body.targets.includes("youtube_shorts") && body.targets.includes("youtube_video"))
    return error("DUPLICATE_PUBLISHER_ACCOUNT_TARGET");
  return {media_id:body.media_id.toLowerCase(),targets:[...body.targets],
    title:body.title.trim(),description:(body.description??"").trim(),
    captions:body.captions,brand_style:body.brand_style};
}

export async function previewPublisher(db, accountId, body, configured = {}, now = Date.now()) {
  if (typeof accountId!=="string" || !UUID.test(accountId)) return error("AUTHENTICATION_REQUIRED",401);
  const draft = normalizePublisherPreview(body);
  if (draft.error) return draft;
  const result = await db.query(
    "select id, mime_type, size_bytes, duration_ms from user_media where id=$1 and account_id=$2 and folder in ('videos','clips')",
    [draft.media_id,accountId]
  );
  const row = result?.rows?.[0];
  if (!row || row.id!==draft.media_id) return error("MEDIA_NOT_FOUND",404);
  if (!/^video\/(mp4|webm|quicktime|x-matroska)$/.test(row.mime_type) ||
      !Number.isSafeInteger(Number(row.size_bytes)) || Number(row.size_bytes)<=0)
    return error("INVALID_PUBLISHER_MEDIA",422);
  const capabilities = await readProviderCapabilities(db,accountId,configured,now);
  const duration = row.duration_ms==null ? null : Number(row.duration_ms);
  const media = {id:row.id,mime_type:row.mime_type,size_bytes:Number(row.size_bytes),
    duration_ms:Number.isSafeInteger(duration)&&duration>0?duration:null};
  return {ok:true,mode:"preview_only",can_publish:false,job_created:false,
    media,draft,targets:draft.targets.map(id=>{
      const p = profiles[id], cap = capabilities.find(c=>c.provider===p.provider);
      const blockers = ["PUBLISHING_NOT_IMPLEMENTED","PROVIDER_ACCEPTANCE_REQUIRED",
        "USER_APPROVAL_REQUIRED","RENDERED_VARIANT_VALIDATION_REQUIRED"];
      if (!cap?.configured) blockers.push("OAUTH_CONFIGURATION_REQUIRED");
      if (cap?.connection!=="record_present") blockers.push("ACCOUNT_CONNECTION_REQUIRED");
      else if (cap.token_status!=="not_expired_unverified") blockers.push("TOKEN_REVALIDATION_REQUIRED");
      if (id==="tiktok") {
        if (cap?.publishing?.publish_scope_recorded!==true) blockers.push("PUBLISH_SCOPE_REQUIRED");
        blockers.push("TIKTOK_CREATOR_INFO_REQUIRED");
      }
      if (media.duration_ms===null) blockers.push("MEDIA_DURATION_UNVERIFIED");
      return {target:id,...p,codec:"h264",container:"mp4",
        state:"blocked",can_publish:false,blockers};
    })};
}
