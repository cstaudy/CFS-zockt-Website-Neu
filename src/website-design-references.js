import {validateWebsiteDesign} from "./website-design-validation.js";
import {checkDesignMediaDeletion} from "./website-design-policy.js";
// Trusted complete state for one website. Other asset consumers must also be checked.
export function collectDesignReferences(state){
 if(!state||!state.draft||!Array.isArray(state.history)||!Object.hasOwn(state,"published"))return {ok:false,error:"REFERENCES_UNAVAILABLE"};
 const refs=[];
 function add(design,scope,revision){
  if(!design||!Object.hasOwn(design,"backgroundAssetId"))return false;
  const result=validateWebsiteDesign(design);
  if(!result.ok)return false;
  if(result.design.backgroundAssetId!==null)refs.push({backgroundAssetId:result.design.backgroundAssetId,scope,revision});
  return true;
 }
 if(!Number.isSafeInteger(state.revision)||state.revision<0||!add(state.draft,"draft",state.revision))return {ok:false,error:"REFERENCES_UNAVAILABLE"};
 const entries=state.published===null?[]:[state.published];
 for(const [scope,rows] of [["published",entries],["history",state.history]]){
  for(const entry of rows){
   if(!entry||!Number.isSafeInteger(entry.revision)||entry.revision<1||entry.revision>state.revision||!add(entry.design,scope,entry.revision))return {ok:false,error:"REFERENCES_UNAVAILABLE"};
  }
 }
 return {ok:true,references:refs};
}
export function checkWebsiteAssetDeletion(state,assetId){
 if(typeof assetId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId))return {ok:false,error:"INVALID_BACKGROUND_ASSET"};
 const result=collectDesignReferences(state);
 if(!result.ok)return result;
 return checkDesignMediaDeletion(assetId.toLowerCase(),result.references);
}
