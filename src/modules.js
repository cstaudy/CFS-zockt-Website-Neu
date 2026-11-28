import { currentAccount } from "./auth.js";
import { getPool } from "./db.js";
import { tiktokConfigured } from "./tiktok.js";
import { twitchConfigured } from "./twitch.js";
import { readCreatorEvidence, launcherEvidence, launcherOnline, providerEvidence } from "./creator-status-evidence.js";
export async function modulesState(req){
  const a=await currentAccount(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};
  const evidence=await readCreatorEvidence(getPool(),a.id,{tiktok:tiktokConfigured(),twitch:twitchConfigured()});
  const status=key=>providerEvidence(evidence.platforms?.find(p=>p.provider===key));
  const module=(key,label,state,allowed=true)=>({key,label,title:label,status:state,allowed,minimum_plan:"free"});
  return {ok:true,modules:[module("tiktok","TikTok",status("tiktok")),module("twitch","Twitch",status("twitch")),
    module("launcher","Launcher",evidence.launcher?.status||"unknown"),module("widget_studio","Widget Studio","available"),
    module("cut_studio","Cut Studio","available"),module("games","Games","available")],account_id:a.id};
}
export async function launcherModuleState(req){
  const a=await currentAccount(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};
  const devices=(await getPool().query("select id,machine_name,client_version,status,obs_connected,obs_version,last_seen_at from launcher_devices where account_id=$1 order by updated_at desc",[a.id])).rows;
  const now=Date.now(), evidence=launcherEvidence(devices,now);
  return {ok:true,state:{devices:devices.map(d=>({...d,online:launcherOnline(d,now),obs_connected:launcherOnline(d,now)&&d.obs_connected===true})),paired:evidence.paired,connected:evidence.paired,online:evidence.online,obs_connected:evidence.obs_connected}};
}
export async function audioModuleState(req,body=null){const a=await currentAccount(req);if(!a)return{error:"AUTHENTICATION_REQUIRED",status:401};const pool=getPool(),row=(await pool.query("select data from creator_projects where account_id=$1 and kind='audio' and status<>'archived' order by updated_at desc limit 1",[a.id])).rows[0];if(body){const data=body.state&&typeof body.state==='object'?body.state:{};const saved=await pool.query("insert into creator_projects(account_id,kind,name,data) values($1,'audio','Audio Preset',$2::jsonb) returning data",[a.id,JSON.stringify(data)]);return{ok:true,state:saved.rows[0].data};}return{ok:true,state:row?.data||{preset_name:"Mein Stream",microphone:85,game:80,discord:80,music:65,alerts:90},status:"preset_only"};}
