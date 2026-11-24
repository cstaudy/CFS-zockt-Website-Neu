// Pure validation for proposed website design settings. No persistence or authorization.
export function validateWebsiteDesign(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {ok:false,error:"INVALID_DESIGN"};
  const keys = ["backgroundAssetId","shade","position","accent"];
  if (Object.keys(input).some(k=>!keys.includes(k))) return {ok:false,error:"UNKNOWN_DESIGN_FIELD"};
  const {backgroundAssetId=null,shade=65,position="center",accent="#28d9f0"}=input;
  if (backgroundAssetId!==null && (typeof backgroundAssetId!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(backgroundAssetId))) return {ok:false,error:"INVALID_BACKGROUND_ASSET"};
  if (!Number.isInteger(shade)||shade<0||shade>90) return {ok:false,error:"INVALID_SHADE"};
  if (!["center","top","bottom","left","right"].includes(position)) return {ok:false,error:"INVALID_POSITION"};
  if (typeof accent!=="string"||!/^#[0-9a-f]{6}$/i.test(accent)) return {ok:false,error:"INVALID_ACCENT"};
  return {ok:true,design:{backgroundAssetId:backgroundAssetId?.toLowerCase()??null,shade,position,accent:accent.toLowerCase()}};
}
