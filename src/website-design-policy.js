// Pure policy helpers. Inputs must come from trusted server-side records.
// These helpers do not authenticate, persist, or lock database rows.
export function checkDesignMedia(assetId, asset, ownerId, publish=false) {
  if (assetId===null) return {ok:true};
  if (typeof assetId!=="string" || typeof ownerId!=="string" || !ownerId || !asset || asset.id!==assetId || asset.accountId!==ownerId) return {ok:false,error:"MEDIA_NOT_AVAILABLE"};
  if (!["image/png","image/jpeg","image/webp"].includes(asset.mimeType) || asset.validated!==true || asset.deleted!==false) return {ok:false,error:"MEDIA_NOT_ELIGIBLE"};
  if (publish && asset.publicApproved!==true) return {ok:false,error:"MEDIA_NOT_APPROVED"};
  return {ok:true};
}
export function checkDesignRevision(expected,current) {
  if (!Number.isSafeInteger(expected)||expected<0||!Number.isSafeInteger(current)||current<0) return {ok:false,error:"INVALID_REVISION"};
  return expected===current?{ok:true}:{ok:false,error:"REVISION_CONFLICT"};
}
// Caller must supply complete references and enforce this in the deletion transaction.
export function checkDesignMediaDeletion(assetId,references) {
  if (typeof assetId!=="string"||!assetId||!Array.isArray(references)||references.some(r=>!r||typeof r!=="object"||!Object.hasOwn(r,"backgroundAssetId"))) return {ok:false,error:"REFERENCES_UNAVAILABLE"};
  return references.some(r=>r.backgroundAssetId===assetId)?{ok:false,error:"MEDIA_IN_USE"}:{ok:true};
}
