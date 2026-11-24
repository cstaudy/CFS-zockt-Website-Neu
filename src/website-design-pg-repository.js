import {decodeDesignSnapshot} from "./website-design-snapshot.js";
// PostgreSQL transaction adapter, not wired to the server.
// Operations are injected by the migration owner; no schema or credentials assumed.
export function createWebsiteDesignRepository(pool,operations){
 if(typeof pool?.connect!=="function"||typeof operations?.loadForMutation!=="function"||typeof operations?.compareAndSwap!=="function")throw new TypeError("Invalid website design repository dependencies");
 return {async transaction(work){
  const client=await pool.connect();
  let begun=false,discard=false;
  try{
   await client.query("BEGIN");begun=true;
   const result=await work({
    async loadForMutation(command,principal){
     const loaded=await operations.loadForMutation(client,command,principal);
     const decoded=decodeDesignSnapshot(loaded?.state);
     if(!decoded.ok)throw Error(decoded.error);
     return {state:decoded.state,context:loaded.context};
    },
    async compareAndSwap(expected,candidate){
     const decoded=decodeDesignSnapshot(candidate);
     if(!decoded.ok||!Number.isSafeInteger(expected)||expected<0||decoded.state.revision!==expected+1)throw Error("INVALID_DESIGN_CANDIDATE");
     return operations.compareAndSwap(client,expected,decoded.state);
    }
   });
   if(result?.status!==200){await client.query("ROLLBACK");begun=false;return result}
   await client.query("COMMIT");begun=false;
   return result;
  }catch(error){
   if(begun){try{await client.query("ROLLBACK")}catch{discard=true}}
   else discard=true;
   throw error;
  }finally{client.release(discard)}
 }};
}
