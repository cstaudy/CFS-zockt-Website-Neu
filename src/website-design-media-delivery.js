import {projectPublicDesign} from "./website-design-public.js";
// Trusted state and asset metadata only. No filesystem access or HTTP route.
// A dedicated website media route must resolve the storage path internally.
export function authorizeWebsiteMedia(requestedId,state,context){
 const denied={status:404,body:{error:"NOT_FOUND"},headers:{"cache-control":"no-store"}};
 if(typeof requestedId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedId))return denied;
 const id=requestedId.toLowerCase();
 const {design}=projectPublicDesign(state,context);
 if(!design||design.backgroundAssetId!==id)return denied;
 return {status:200,assetId:id,headers:{"cache-control":"no-store","x-content-type-options":"nosniff","content-type":context.asset.mimeType}};
}
