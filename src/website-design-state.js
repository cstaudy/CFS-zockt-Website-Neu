import {validateWebsiteDesign} from "./website-design-validation.js";
import {checkDesignRevision,checkDesignMedia} from "./website-design-policy.js";
// Pure state transitions; trusted state and media records only.
// Persistence, admin authorization and atomic compare-and-swap belong to the caller.
export function initialDesignState(){
 const design=validateWebsiteDesign({}).design;
 return {revision:0,draft:{...design},published:null,history:[]};
}
export function transitionDesign(state,command,context){
 const revision=checkDesignRevision(command?.expectedRevision,state.revision);
 if(!revision.ok)return revision;
 if(state.revision===Number.MAX_SAFE_INTEGER)return {ok:false,error:"REVISION_EXHAUSTED"};
 const next=state.revision+1;
 let input;
 switch(command.type){
 case "save": input=command.design;break;
 case "publish": input=state.draft;break;
 case "restore": {
 const entry=state.history.find(e=>e.revision===command.sourceRevision);
 if(!entry)return {ok:false,error:"VERSION_NOT_FOUND"};
 input=entry.design;break;
 }
 default:return {ok:false,error:"INVALID_COMMAND"};
 }
 const result=validateWebsiteDesign(input);
 if(!result.ok)return result;
 const design=result.design;
 const media=checkDesignMedia(design.backgroundAssetId,context?.asset,context?.ownerId,command.type==="publish");
 if(!media.ok)return media;
 if(command.type==="publish"){
 const entry={revision:next,design:{...design}};
 return {ok:true,state:{...state,revision:next,draft:{...design},published:{revision:next,design:{...design}},history:[...state.history,entry]}};
 }
 return {ok:true,state:{...state,revision:next,draft:{...design}}};
}
