// Existing Twitch connection row, existing encryption, no new OAuth scopes.
// Only called from the authenticated profile-sync route. No background worker.
const VALIDATE_URL = "https://id.twitch.tv/oauth2/validate";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const USER_URL = "https://api.twitch.tv/helix/users";
const fail = (error,status) => ({error,status});
const token = v => typeof v === "string" && v.length>0 && v.length<=16384 && !/[\s\x00-\x1f\x7f]/.test(v);
const seconds = v => Number.isSafeInteger(v) && v>0 && v<=366*86400;
const scopes = v => Array.isArray(v) && v.length<=100 && v.every(s=>typeof s==="string" && /^[a-zA-Z0-9_:.-]{1,128}$/.test(s));
export function validTwitchValidation(value, clientId, userId) {
  return Boolean(value && value.client_id===clientId && value.user_id===userId &&
    typeof userId==="string" && userId.length>0 && seconds(value.expires_in) && scopes(value.scopes));
}
export function validTwitchRefresh(value) {
  return Boolean(value && token(value.access_token) && token(value.refresh_token) &&
    seconds(value.expires_in) && String(value.token_type).toLowerCase()==="bearer");
}

export async function syncTwitchConnection({pool,accountId,open,seal,env,fetchImpl=globalThis.fetch}) {
  if (!accountId || !pool || !env?.TWITCH_CLIENT_ID || !env?.TWITCH_CLIENT_SECRET || !env?.SESSION_SECRET)
    return fail("TWITCH_NOT_CONFIGURED",503);
  let client, transaction=false;
  // Shared deadline across all HTTP requests, not one timeout per request.
  const signal=AbortSignal.timeout(10000);
  const send=async (url,options={})=>fetchImpl(url,{...options,redirect:"error",signal});
  const validate=async access=>send(VALIDATE_URL,{headers:{Authorization:"OAuth "+access}});
  try {
    client=await pool.connect();
    await client.query("BEGIN"); transaction=true;
    await client.query("SET LOCAL lock_timeout = '8s'");
    const row=(await client.query(
      "select twitch_user_id,access_token,refresh_token from twitch_connections where account_id=$1 for update",[accountId])).rows[0];
    const finish=async result=>{await client.query("COMMIT");transaction=false;return result;};
    if (!row) return await finish(fail("TWITCH_NOT_CONNECTED",404));
    let access=open(row.access_token), encryptedRefresh=row.refresh_token, encryptedAccess=row.access_token;
    if (!token(access)) return await finish(fail("TWITCH_RECONNECT_REQUIRED",409));
    let validation=await validate(access), rotated=false;
    if (validation.status===401) {
      const refresh=open(row.refresh_token);
      if (!token(refresh)) return await finish(fail("TWITCH_RECONNECT_REQUIRED",409));
      const response=await send(TOKEN_URL,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
        body:new URLSearchParams({client_id:env.TWITCH_CLIENT_ID,client_secret:env.TWITCH_CLIENT_SECRET,
          grant_type:"refresh_token",refresh_token:refresh})});
      if (!response.ok) return await finish(fail(
        [400,401].includes(response.status)?"TWITCH_RECONNECT_REQUIRED":"TWITCH_REFRESH_UNAVAILABLE",
        [400,401].includes(response.status)?409:502));
      const grant=await response.json();
      if (!validTwitchRefresh(grant)) return await finish(fail("TWITCH_RECONNECT_REQUIRED",409));
      access=grant.access_token; encryptedAccess=seal(access); encryptedRefresh=seal(grant.refresh_token);
      rotated=true;
      validation=await validate(access);
    }
    if (!validation.ok) return await finish(fail(rotated||validation.status===401?
      "TWITCH_RECONNECT_REQUIRED":"TWITCH_VALIDATION_UNAVAILABLE",rotated||validation.status===401?409:502));
    const metadata=await validation.json();
    if (!validTwitchValidation(metadata,env.TWITCH_CLIENT_ID,row.twitch_user_id))
      return await finish(fail("TWITCH_RECONNECT_REQUIRED",409));
    const stored=await client.query(
      "update twitch_connections set access_token=$2,refresh_token=$3,expires_at=now()+($4::integer * interval '1 second'),scope=$5,updated_at=now() where account_id=$1 and twitch_user_id=$6",
      [accountId,encryptedAccess,encryptedRefresh,metadata.expires_in,metadata.scopes.join(" "),row.twitch_user_id]);
    if (stored.rowCount!==1) throw new Error("TWITCH_TOKEN_WRITE_FAILED");
    // Keep the row lock through profile sync so disconnect/reconnect cannot
    // race a stale profile update. A profile failure still commits verified
    // token rotation: reverting to a consumed refresh token is unsafe.
    let user;
    try {
      const response=await send(USER_URL,{headers:{Authorization:"Bearer "+access,"Client-Id":env.TWITCH_CLIENT_ID}});
      if (!response.ok) return await finish(fail("TWITCH_SYNC_FAILED",502));
      user=(await response.json())?.data?.[0];
    } catch { return await finish(fail("TWITCH_SYNC_FAILED",502)); }
    if (!user || user.id!==row.twitch_user_id || typeof user.login!=="string" ||
        typeof user.display_name!=="string" || (user.email!==undefined && typeof user.email!=="string"))
      return await finish(fail("TWITCH_PROFILE_FAILED",502));
    const profile=await client.query(
      "update twitch_connections set login=$2,display_name=$3,email=$4,updated_at=now() where account_id=$1 and twitch_user_id=$5",
      [accountId,user.login,user.display_name,user.email||"",row.twitch_user_id]);
    if(profile.rowCount!==1) throw new Error("TWITCH_PROFILE_WRITE_FAILED");
    return await finish({ok:true,connected:true,account:{id:user.id,login:user.login,display_name:user.display_name,email:user.email||""},
      synced_at:new Date().toISOString()});
  } catch {
    if(transaction) await client.query("ROLLBACK").catch(()=>{});
    return fail("TWITCH_SYNC_UNAVAILABLE",502);
  } finally {client?.release();}
}
