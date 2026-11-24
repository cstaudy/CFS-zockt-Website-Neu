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
    loadForMutation:(command,principal)=>operations.loadForMutation(client,command,principal),
    compareAndSwap:(expected,candidate)=>operations.compareAndSwap(client,expected,candidate)
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
