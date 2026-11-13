import { getPool } from "./db.js";
import { requireAccount } from "./projects.js";
import { listAssets } from "./assets.js";

const designs=[
  {key:"blitze",label:"Blitze",description:"Klarer Neon-Look für Gaming",accent:"#20c7ff",second:"#8be9ff",surface:"#071827"},
  {key:"nacht",label:"Nacht",description:"Dunkel und fokussiert",accent:"#8b5cf6",second:"#c4b5fd",surface:"#100b20"},
  {key:"pulse",label:"Pulse",description:"Energie für Live-Momente",accent:"#ff4d8d",second:"#ffb86b",surface:"#210b18"}
];
const platforms=[{key:"obs",label:"OBS / Stream",short_label:"OBS",kind:"static"},{key:"tiktok",label:"TikTok LIVE",short_label:"TIKTOK",kind:"live"},{key:"twitch",label:"Twitch",short_label:"TWITCH",kind:"live"}];
const registry=[{key:"follower_goal",label:"Follower Goal",description:"Follower-Ziel",provider:"tiktok",available:true,mode:"goal",metric:"followers"},{key:"follower_goal",label:"Follower Goal",description:"Follower-Ziel",provider:"twitch",available:true,mode:"goal",metric:"followers"},{key:"chat",label:"Live Chat",description:"Chat-Feed",provider:"twitch",available:true,mode:"chat"}];
function view(row){const data=row.data||{},config=data.config||{};return{id:row.id,name:row.name,design_key:config.design_key||"blitze",platforms:Array.isArray(config.platforms)?config.platforms:["obs"],elements:Array.isArray(config.elements)?config.elements:[],settings:config.settings||{},version:row.version||1,created_at:row.created_at,updated_at:row.updated_at};}
const MAX_BUNDLE_BYTES = 512 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
function bundleInput(body, needsConfig = true) {
  if (!isObject(body)) return "INVALID_BUNDLE_REQUEST";
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim() || body.name.length > 140)) return "INVALID_BUNDLE_NAME";
  if (!needsConfig) return null;
  if (!isObject(body.config)) return "INVALID_BUNDLE_CONFIG";
  const config = body.config;
  if (config.elements !== undefined && (!Array.isArray(config.elements) || config.elements.length > 100 ||
      config.elements.some(element => !isObject(element)))) return "INVALID_BUNDLE_ELEMENTS";
  if (config.platforms !== undefined && (!Array.isArray(config.platforms) || config.platforms.length > 10 ||
      config.platforms.some(platform => typeof platform !== "string" || platform.length > 50))) return "INVALID_BUNDLE_PLATFORMS";
  if (config.settings !== undefined && !isObject(config.settings)) return "INVALID_BUNDLE_SETTINGS";
  if (Buffer.byteLength(JSON.stringify({type:"universal_bundle",config}), "utf8") > MAX_BUNDLE_BYTES) return "BUNDLE_TOO_LARGE";
  return null;
}
function checkVersion(body) {
  return isObject(body) && Number.isSafeInteger(body.version) && body.version >= 1;
}
async function account(req){return requireAccount(req);}
async function getOwnedBundle(pool, accountId, id) {
  if (!UUID.test(String(id))) return null;
  const result = await pool.query(
    "select id,name,data,version from creator_projects where id=$1 and account_id=$2 and kind='design' and data->>'type'='universal_bundle' and status <> 'archived'",
    [id,accountId]
  );
  return result.rows[0] || null;
}
export async function builderState(req){
  const a=await account(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};
  const assets=await listAssets(req);
  const result=await getPool().query(
    "select id,name,data,status,version,created_at,updated_at from creator_projects where account_id=$1 and kind='design' and status <> 'archived' and data->>'type'='universal_bundle' order by updated_at desc",
    [a.id]
  );
  return{ok:true,designs,platforms,registry,assets:assets.assets||[],bundles:result.rows.map(view),access:{plan:a.plan||"free"},settings:{}};
}
export async function saveBundle(req,body,id=null){
  const a=await account(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};
  const issue=bundleInput(body);
  if(issue)return{error:issue,status:issue==="BUNDLE_TOO_LARGE"?413:400};
  const name=body.name?.trim()||"Mein Creator Bundle";
  const pool=getPool();
  const data=JSON.stringify({type:"universal_bundle",config:body.config});
  if(id){
    const old=await getOwnedBundle(pool,a.id,id);
    if(!old)return{error:"BUNDLE_NOT_FOUND",status:404};
    if(!checkVersion(body))return{error:"INVALID_BUNDLE_VERSION",status:400};
    const result=await pool.query(
      "update creator_projects set name=$3,data=$4::jsonb,version=version+1,updated_at=now() where id=$1 and account_id=$2 and kind='design' and data->>'type'='universal_bundle' and status <> 'archived' and version=$5 returning id,name,data,status,version,created_at,updated_at",
      [id,a.id,name,data,body.version]
    );
    return result.rows[0]?{ok:true,bundle:view(result.rows[0])}:{error:"BUNDLE_VERSION_CONFLICT",status:409};
  }
  const result=await pool.query(
    "insert into creator_projects(account_id,kind,name,data) values($1,'design',$2,$3::jsonb) returning id,name,data,status,version,created_at,updated_at",
    [a.id,name,data]
  );
  return{ok:true,bundle:view(result.rows[0])};
}
export async function renameBundle(req,id,body){
  const a=await account(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};
  const issue=bundleInput(body,false);
  if(issue)return{error:issue,status:400};
  if(typeof body.name!=="string"||!body.name.trim())return{error:"INVALID_BUNDLE_NAME",status:400};
  const pool=getPool(),old=await getOwnedBundle(pool,a.id,id);
  if(!old)return{error:"BUNDLE_NOT_FOUND",status:404};
  if(!checkVersion(body))return{error:"INVALID_BUNDLE_VERSION",status:400};
  const result=await pool.query(
    "update creator_projects set name=$3,version=version+1,updated_at=now() where id=$1 and account_id=$2 and kind='design' and data->>'type'='universal_bundle' and status <> 'archived' and version=$4 returning id,name,data,status,version,created_at,updated_at",
    [id,a.id,body.name.trim(),body.version]
  );
  return result.rows[0]?{ok:true,bundle:view(result.rows[0])}:{error:"BUNDLE_VERSION_CONFLICT",status:409};
}
export async function deleteBundle(req,id,body){
  const a=await account(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};
  const pool=getPool(),old=await getOwnedBundle(pool,a.id,id);
  if(!old)return{error:"BUNDLE_NOT_FOUND",status:404};
  if(!checkVersion(body))return{error:"INVALID_BUNDLE_VERSION",status:400};
  const result=await pool.query(
    "update creator_projects set status='archived',version=version+1,updated_at=now() where id=$1 and account_id=$2 and kind='design' and data->>'type'='universal_bundle' and status <> 'archived' and version=$3 returning id",
    [id,a.id,body.version]
  );
  return result.rows[0]?{ok:true,deleted:true}:{error:"BUNDLE_VERSION_CONFLICT",status:409};
}
