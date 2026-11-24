import {prepareDesignMutation} from "./website-design-api-contract.js";
// Repository contract: loadForMutation and compareAndSwap run inside one transaction.
// The repository must lock relevant media rows and resolve trusted authorization.
// No production repository implementation is provided here.
export async function persistDesignMutation(repository,command,principal){
 return repository.transaction(async tx=>{
  const {state,context}=await tx.loadForMutation(command,principal);
  const result=prepareDesignMutation(state,command,context);
  if(result.status!==200)return {status:result.status,body:result.body};
  const committed=await tx.compareAndSwap(result.expectedRevision,result.candidate);
  if(committed!==true)return {status:409,body:{error:"REVISION_CONFLICT"}};
  return {status:200,body:result.body};
 });
}
