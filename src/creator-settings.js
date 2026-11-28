import { currentAccount } from "./auth.js";
import { getPool } from "./db.js";
import { createHash } from "node:crypto";

const MAX_BYTES=60*1024;
const object=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const own=(o,k)=>Object.hasOwn(o,k);
const fail=(error,status)=>({error,status});
const setupFields=["theme","start_module","widgets","active_game","follower_goal","show_mode"];
const widgets=["follower_goal","likes","viewer","gifts","auto_thanks","custom_branding"];
export function normalizeCreatorSetup(value){
  if(!object(value)||Object.keys(value).length!==setupFields.length||!setupFields.every(k=>own(value,k)))return null;
  if(value.theme!=="cfs"||!["dashboard","tiktok","launcher","games","cut_studio"].includes(value.start_module)||
    !["","chat_battle","community_quiz","gift_rush"].includes(value.active_game)||!["standard","minimal","game"].includes(value.show_mode)||
    !Number.isSafeInteger(value.follower_goal)||value.follower_goal<1||value.follower_goal>10000000||
    !Array.isArray(value.widgets)||value.widgets.length>widgets.length||
    !value.widgets.every(w=>widgets.includes(w))||new Set(value.widgets).size!==value.widgets.length)return null;
  // Preferences only; these identifiers never enable features, plans or live widgets.
  return {theme:value.theme,start_module:value.start_module,widgets:widgets.filter(w=>value.widgets.includes(w)),
    active_game:value.active_game,follower_goal:value.follower_goal,show_mode:value.show_mode};
}
function setupVersion(settings){
  return own(settings,"creator_setup")?createHash("sha256").update(JSON.stringify(settings.creator_setup)).digest("hex"):null;
}
function setupView(row){
  const settings=row?.settings||{};
  if(!object(settings))return {creator_setup:null,setup_version:null,setup_status:"invalid",updated_at:row?.updated_at||null};
  const present=own(settings,"creator_setup"),setup=present?normalizeCreatorSetup(settings.creator_setup):null;
  return {creator_setup:setup,setup_version:setupVersion(settings),setup_status:present?(setup?"saved":"invalid"):"not_saved",updated_at:row?.updated_at||null};
}
async function getSettings(db,accountId){
  return (await db.query("select settings,updated_at from creator_settings where account_id=$1",[accountId])).rows[0];
}
export async function readCreatorSetup(db,accountId){
  return setupView(await getSettings(db,accountId));
}
async function changeSettings(pool,accountId,transform){
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    const account=await client.query("select id from accounts where id=$1 for update",[accountId]);
    if(account.rowCount!==1){await client.query("ROLLBACK");return fail("AUTHENTICATION_REQUIRED",401);}
    const row=await getSettings(client,accountId),current=row?.settings||{};
    if(!object(current)){await client.query("ROLLBACK");return fail("SETTINGS_REVIEW_REQUIRED",409);}
    const next=transform(current);
    if(next.error){await client.query("ROLLBACK");return next;}
    const serialized=JSON.stringify(next.settings);
    if(Buffer.byteLength(serialized,"utf8")>MAX_BYTES){await client.query("ROLLBACK");return fail("SETTINGS_TOO_LARGE",413);}
    const saved=(await client.query("insert into creator_settings(account_id,settings,updated_at) values($1,$2::jsonb,now()) on conflict(account_id) do update set settings=excluded.settings,updated_at=now() returning settings,updated_at",[accountId,serialized])).rows[0];
    await client.query("COMMIT");
    return {ok:true,row:saved};
  }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error;}
  finally{client.release();}
}
export async function saveCreatorSetup(pool,accountId,body){
  if(!object(body)||Object.keys(body).length!==2||!own(body,"state")||!own(body,"expected_version")||
    !object(body.state)||Object.keys(body.state).length!==1||!own(body.state,"creator_setup")||
    !(body.expected_version===null||(typeof body.expected_version==="string"&&/^[0-9a-f]{64}$/.test(body.expected_version))))
    return fail("INVALID_CREATOR_SETUP",400);
  const setup=normalizeCreatorSetup(body.state.creator_setup);
  if(!setup)return fail("INVALID_CREATOR_SETUP",400);
  const result=await changeSettings(pool,accountId,current=>{
    if(own(current,"creator_setup")&&!normalizeCreatorSetup(current.creator_setup))return fail("SETUP_REVIEW_REQUIRED",409);
    if(setupVersion(current)!==body.expected_version)return fail("SETUP_VERSION_CONFLICT",409);
    return {settings:{...current,creator_setup:setup}};
  });
  return result.error?result:{ok:true,...setupView(result.row)};
}
export async function creatorSettings(req,body=null){
  const account=await currentAccount(req);
  if(!account)return fail("AUTHENTICATION_REQUIRED",401);
  // The shared settings response must not turn a role label into privilege;
  // accountAccessView already applies the administrator email/role/verified gate.
  const pool=getPool(),entitlements={plan:account.plan||"free",admin:account.admin===true};
  if(body===null){const row=await getSettings(pool,account.id);return {ok:true,settings:row?.settings||{},updated_at:row?.updated_at||null,entitlements};}
  if(!object(body?.settings))return fail("INVALID_SETTINGS",400);
  if(own(body.settings,"creator_setup"))return fail("USE_CREATOR_SETUP_API",409);
  // Preserve the reserved setup namespace on ordinary settings replacement.
  const result=await changeSettings(pool,account.id,current=>({settings:{...body.settings,
    ...(own(current,"creator_setup")?{creator_setup:current.creator_setup}:{})}}));
  return result.error?result:{ok:true,settings:result.row.settings,updated_at:result.row.updated_at,entitlements};


}
