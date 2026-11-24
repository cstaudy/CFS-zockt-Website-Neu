// Storage snapshot codec. No SQL schema or database access.
import {validateWebsiteDesign} from "./website-design-validation.js";
export function decodeDesignSnapshot(raw){
 const invalid=()=>({ok:false,error:"INVALID_STORED_DESIGN"});
 if(!raw||!Number.isSafeInteger(raw.revision)||raw.revision<0||!Array.isArray(raw.history)||!Object.hasOwn(raw,"published"))return invalid();
 const decode=d=>{
  if(!d||!["backgroundAssetId","shade","position","accent"].every(k=>Object.hasOwn(d,k)))return null;
  const result=validateWebsiteDesign(d);return result.ok?result.design:null;
 };
 const draft=decode(raw.draft);if(!draft)return invalid();
 const history=[];let previous=0;
 for(const entry of raw.history){
  if(!entry||!Number.isSafeInteger(entry.revision)||entry.revision<=previous||entry.revision>raw.revision)return invalid();
  const design=decode(entry.design);if(!design)return invalid();
  history.push({revision:entry.revision,design});previous=entry.revision;
 }
 let published=null;
 if(raw.published!==null){
  const last=history.at(-1),design=decode(raw.published?.design);
  if(!last||!design||raw.published.revision!==last.revision||JSON.stringify(design)!==JSON.stringify(last.design))return invalid();
  published={revision:last.revision,design};
 }else if(history.length)return invalid();
 return {ok:true,state:{revision:raw.revision,draft,published,history}};
}
