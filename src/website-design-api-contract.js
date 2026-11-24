import {transitionDesign} from "./website-design-state.js";
import {projectPublicDesign} from "./website-design-public.js";
// Transport-independent API contract. Context is supplied ONLY by trusted server code.
// No HTTP routes or persistence; successful mutations are candidates for atomic commit.
export function prepareDesignMutation(state,body,context){
 if(!context?.accountId)return {status:401,body:{error:"AUTHENTICATION_REQUIRED"}};
 if(context.isAdmin!==true)return {status:403,body:{error:"ADMIN_REQUIRED"}};
 if(context.elevated!==true)return {status:428,body:{error:"ADMIN_ELEVATION_REQUIRED"}};
 if(!body||typeof body!=="object"||Array.isArray(body))return {status:400,body:{error:"INVALID_COMMAND"}};
 const allowed={save:["type","expectedRevision","design"],publish:["type","expectedRevision"],restore:["type","expectedRevision","sourceRevision"]};
 if(!Object.hasOwn(allowed,body.type)||Object.keys(body).some(k=>!allowed[body.type].includes(k)))return {status:400,body:{error:"INVALID_COMMAND"}};
 const result=transitionDesign(state,body,{ownerId:context.accountId,asset:context.asset});
 if(!result.ok)return {status:result.error==="REVISION_CONFLICT"?409:result.error==="VERSION_NOT_FOUND"?404:400,body:{error:result.error}};
 return {status:200,body:{ok:true,revision:result.state.revision},candidate:result.state,expectedRevision:body.expectedRevision};
}
export function publicDesignResponse(state,context){
 return {status:200,body:projectPublicDesign(state,context),headers:{"cache-control":"no-store"}};
}
