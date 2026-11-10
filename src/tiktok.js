import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getPool } from "./db.js";
import { currentAccount, sessionFromRequest, cookie } from "./auth.js";

const redirectUri = () => process.env.TIKTOK_REDIRECT_URI || `${process.env.APP_BASE_URL || ""}/api/auth/tiktok/callback`;
const key = () => createHash("sha256").update(String(process.env.SESSION_SECRET || "missing-session-secret")).digest();
function seal(value) { const iv=randomBytes(12), cipher=createCipheriv("aes-256-gcm",key(),iv); const data=Buffer.concat([cipher.update(String(value),"utf8"),cipher.final()]); return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`; }
function open(value) { const [iv,tag,data]=String(value||"").split("."); if(!iv||!tag||!data)return ""; const decipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64url")); decipher.setAuthTag(Buffer.from(tag,"base64url")); return Buffer.concat([decipher.update(Buffer.from(data,"base64url")),decipher.final()]).toString("utf8"); }

export function tiktokConfigured() { return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && redirectUri()); }
export async function getTikTokStatus(req) {
  const account=await currentAccount(req); if(!account)return{error:"AUTHENTICATION_REQUIRED",status:401};
  const row=(await getPool().query("select open_id,scope,expires_at,updated_at from tiktok_connections where account_id=$1",[account.id])).rows[0];
  return{ok:true,configured:tiktokConfigured(),connected:Boolean(row),profile:row?{open_id:row.open_id}:null,scope:row?.scope||"",expires_at:row?.expires_at||null,updated_at:row?.updated_at||null};
}
export async function startTikTok(req, res) {
  const account = await currentAccount(req); if (!account) return { error:"AUTHENTICATION_REQUIRED", status:401 };
  if (!tiktokConfigured()) return { error:"TIKTOK_NOT_CONFIGURED", status:503 };
  const state = randomBytes(32).toString("base64url");
  const pool = getPool();
  await pool.query("insert into oauth_states (account_id, provider, state, expires_at) values ($1, 'tiktok', $2, now() + interval '10 minutes')", [account.id, state]);
  const params = new URLSearchParams({ client_key:process.env.TIKTOK_CLIENT_KEY, response_type:"code", scope:"user.info.basic", redirect_uri:redirectUri(), state });
  res.setHeader("set-cookie", cookie("cfs_tiktok_oauth", state, 600));
  res.writeHead(302,{location:`https://www.tiktok.com/v2/auth/authorize/?${params}`}); res.end(); return null;
}

export async function finishTikTok(req, res, url) {
  const state = String(url.searchParams.get("state")||""), code=String(url.searchParams.get("code")||""), cookiePrefix="cfs_tiktok_oauth=", cookieState=String(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(cookiePrefix))?.slice(cookiePrefix.length)||"";
  if (!state || state!==cookieState || !code) return { error:"TIKTOK_OAUTH_STATE_INVALID", status:400 };
  const row = (await getPool().query("delete from oauth_states where provider='tiktok' and state=$1 and expires_at > now() returning account_id",[state])).rows[0];
  if (!row) return { error:"TIKTOK_OAUTH_STATE_EXPIRED", status:400 };
  const tokenResponse=await fetch("https://open.tiktokapis.com/v2/oauth/token/",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_key:process.env.TIKTOK_CLIENT_KEY,client_secret:process.env.TIKTOK_CLIENT_SECRET,code,grant_type:"authorization_code",redirect_uri:redirectUri()})});
  const token=await tokenResponse.json(); if(!tokenResponse.ok||!token.access_token)return { error:"TIKTOK_TOKEN_EXCHANGE_FAILED", status:502, detail:token.error_description||token.error||"TikTok token exchange failed" };
  await getPool().query("insert into tiktok_connections (account_id, open_id, access_token, refresh_token, expires_at, refresh_expires_at, scope, updated_at) values ($1,$2,$3,$4,now()+($5||' seconds')::interval,now()+($6||' seconds')::interval,$7,now()) on conflict (account_id) do update set open_id=excluded.open_id, access_token=excluded.access_token, refresh_token=excluded.refresh_token, expires_at=excluded.expires_at, refresh_expires_at=excluded.refresh_expires_at, scope=excluded.scope, updated_at=now()",[row.account_id,token.open_id||"",seal(token.access_token),seal(token.refresh_token||""),String(token.expires_in||86400),String(token.refresh_token_expires_in||31536000),token.scope||""]);
  res.setHeader("set-cookie", cookie("cfs_tiktok_oauth","",0)); res.writeHead(302,{location:"/pages/integrations.html?tiktok=connected"}); res.end(); return null;
}

