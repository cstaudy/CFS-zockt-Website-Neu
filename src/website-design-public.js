import {validateWebsiteDesign} from "./website-design-validation.js";
import {checkDesignMedia} from "./website-design-policy.js";
// Only trusted published state and server-resolved media records may enter here.
// Null design means retain the existing public CSS, not preview defaults.
export function projectPublicDesign(state,context){
 const published=state?.published;
 if(!published||!Number.isSafeInteger(published.revision)||published.revision<1)return {design:null};
 const result=validateWebsiteDesign(published.design);
 if(!result.ok)return {design:null};
 const {backgroundAssetId,shade,position,accent}=result.design;
 if(!checkDesignMedia(backgroundAssetId,context?.asset,context?.ownerId,true).ok)return {design:null};
 // The eventual public media endpoint must independently enforce publication.
 return {design:{revision:published.revision,backgroundAssetId,shade,position,accent}};
}
