import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getPool } from "./db.js";
import { currentAccount, sessionFromRequest, cookie } from "./auth.js";

const redirectUri = () => process.env.TIKTOK_REDIRECT_URI || `${process.env.APP_BASE_URL || ""}/api/auth/tiktok/callback`;
const key = () => process.env.SESSION_SECRET ? createHash("sha256").update(process.env.SESSION_SECRET).digest() : null;
function seal(value) { const secret=key(); if(!secret)throw new Error("SESSION_SECRET fehlt für TikTok-OAuth"); const iv=randomBytes(12), cipher=createCipheriv("aes-256-gcm",secret,iv); const data=Buffer.concat([cipher.update(String(value),"utf8"),cipher.final()]); return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`; }
function open(value) { const secret=key(); if(!secret)return ""; const [iv,tag,data]=String(value||"").split("."); if(!iv||!tag||!data)return ""; try{const decipher=createDecipheriv("aes-256-gcm",secret,Buffer.from(iv,"base64url")); decipher.setAuthTag(Buffer.from(tag,"base64url")); return Buffer.concat([decipher.update(Buffer.from(data,"base64url")),decipher.final()]).toString("utf8");}catch{return ""} }

export function tiktokConfigured() { return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.SESSION_SECRET && redirectUri()); }
export async function getTikTokStatus(req) {
  const account=await currentAccount(req); if(!account)return{error:"AUTHENTICATION_REQUIRED",status:401};
  const row=(await getPool().query("select open_id,scope,expires_at,updated_at from tiktok_connections where account_id=$1",[account.id])).rows[0];
  return{ok:true,configured:tiktokConfigured(),connected:Boolean(row),profile:row?{open_id:row.open_id}:null,scope:row?.scope||"",expires_at:row?.expires_at||null,updated_at:row?.updated_at||null};
}
export async function disconnectTikTok(req){const account=await currentAccount(req);if(!account)return{error:"AUTHENTICATION_REQUIRED",status:401};const r=await getPool().query("delete from tiktok_connections where account_id=$1 returning account_id",[account.id]);return{ok:true,disconnected:Boolean(r.rowCount)};}
export async function syncTikTok(req){const account=await currentAccount(req);if(!account)return{error:"AUTHENTICATION_REQUIRED",status:401};const row=(await getPool().query("select access_token from tiktok_connections where account_id=$1",[account.id])).rows[0];const access=open(row?.access_token);if(!access)return{error:"TIKTOK_NOT_CONNECTED",status:404};const response=await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url,follower_count",{headers:{Authorization:`Bearer ${access}`}});if(!response.ok)return{error:"TIKTOK_SYNC_FAILED",status:502};const profile=(await response.json()).data?.user||{};return{ok:true,connected:true,profile:{display_name:profile.display_name||"",avatar_url:profile.avatar_url||"",follower_count:Number(profile.follower_count||0)},synced_at:new Date().toISOString()};}
export async function publicTikTokVideos(){const emails=[process.env.CFS_ADMIN_DESKTOP_OWNER_EMAIL,...String(process.env.CFS_ADMIN_EMAILS||"").split(",")].map(x=>String(x||"").trim().toLowerCase()).filter(Boolean);if(!emails.length)return{ok:true,connected:false,videos:[],message:"TikTok-Videos sind noch nicht veröffentlicht."};const pool=getPool(),row=(await pool.query("select c.access_token,c.scope from tiktok_connections c join accounts a on a.id=c.account_id where lower(a.email)=any($1::text[]) limit 1",[emails])).rows[0];const access=open(row?.access_token);if(!access)return{ok:true,connected:false,videos:[],message:"TikTok ist noch nicht verbunden."};if(!String(row.scope||"").split(/[ ,]+/).includes("video.list"))return{ok:true,connected:true,videos:[],scope_required:"video.list",message:"TikTok-Videos benötigen noch die Freigabe video.list."};const response=await fetch("https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,cover_image_url,share_url,create_time",{method:"POST",headers:{Authorization:`Bearer ${access}`,"content-type":"application/json"},body:JSON.stringify({max_count:6})});if(!response.ok)return{ok:false,connected:true,videos:[],message:"TikTok-Videos konnten nicht geladen werden."};const data=await response.json(),videos=Array.isArray(data.data?.videos)?data.data.videos:[];return{ok:true,connected:true,videos:videos.map(v=>({id:v.id,title:v.title||v.video_description||"TikTok-Video",thumbnail_url:v.cover_image_url||"",url:v.share_url||"",published_at:v.create_time?new Date(Number(v.create_time)*1000).toISOString():null}))};}
export async function startTikTok(req, res) {
  const account = await currentAccount(req); if (!account) return { error:"AUTHENTICATION_REQUIRED", status:401 };
  if (!tiktokConfigured()) return { error:"TIKTOK_NOT_CONFIGURED", status:503 };
  const state = randomBytes(32).toString("base64url");
  const pool = getPool();
  await pool.query("insert into oauth_states (account_id, provider, state, expires_at) values ($1, 'tiktok', $2, now() + interval '10 minutes')", [account.id, state]);
  const params = new URLSearchParams({ client_key:process.env.TIKTOK_CLIENT_KEY, response_type:"code", scope:"user.info.basic,video.list", redirect_uri:redirectUri(), state });
  res.setHeader("set-cookie", cookie("cfs_tiktok_oauth", state, 600));
  res.writeHead(302,{location:`https://www.tiktok.com/v2/auth/authorize/?${params}`}); res.end(); return null;
}

export async function finishTikTok(req, res, url) {
  if (!tiktokConfigured()) return { error:"TIKTOK_NOT_CONFIGURED", status:503 };
  const state = String(url.searchParams.get("state")||""), code=String(url.searchParams.get("code")||""), cookiePrefix="cfs_tiktok_oauth=", cookieState=String(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(cookiePrefix))?.slice(cookiePrefix.length)||"";
  if (!state || state!==cookieState || !code) return { error:"TIKTOK_OAUTH_STATE_INVALID", status:400 };
  const row = (await getPool().query("delete from oauth_states where provider='tiktok' and state=$1 and expires_at > now() returning account_id",[state])).rows[0];
  if (!row) return { error:"TIKTOK_OAUTH_STATE_EXPIRED", status:400 };
  const tokenResponse=await fetch("https://open.tiktokapis.com/v2/oauth/token/",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_key:process.env.TIKTOK_CLIENT_KEY,client_secret:process.env.TIKTOK_CLIENT_SECRET,code,grant_type:"authorization_code",redirect_uri:redirectUri()})});
  const token=await tokenResponse.json(); if(!tokenResponse.ok||!token.access_token)return { error:"TIKTOK_TOKEN_EXCHANGE_FAILED", status:502, detail:token.error_description||token.error||"TikTok token exchange failed" };
  await getPool().query("insert into tiktok_connections (account_id, open_id, access_token, refresh_token, expires_at, refresh_expires_at, scope, updated_at) values ($1,$2,$3,$4,now()+($5||' seconds')::interval,now()+($6||' seconds')::interval,$7,now()) on conflict (account_id) do update set open_id=excluded.open_id, access_token=excluded.access_token, refresh_token=excluded.refresh_token, expires_at=excluded.expires_at, refresh_expires_at=excluded.refresh_expires_at, scope=excluded.scope, updated_at=now()",[row.account_id,token.open_id||"",seal(token.access_token),seal(token.refresh_token||""),String(token.expires_in||86400),String(token.refresh_token_expires_in||31536000),token.scope||""]);
  res.setHeader("set-cookie", cookie("cfs_tiktok_oauth","",0)); res.writeHead(302,{location:"/pages/integrations.html?tiktok=connected"}); res.end(); return null;
}
