import { LAUNCHER_ONLINE_MS } from "./playstation-state.js";
import { readProviderCapabilities } from "./provider-capabilities.js";

export function launcherOnline(row, now=Date.now()) {
  const seen=row?.last_seen_at == null ? NaN : new Date(row.last_seen_at).getTime();
  return row?.status==="active" && Number.isFinite(now) && Number.isFinite(seen) &&
    seen<=now && now-seen<LAUNCHER_ONLINE_MS;
}
export function launcherEvidence(rows, now=Date.now()) {
  if(!Array.isArray(rows))throw Error("LAUNCHER_METADATA_UNAVAILABLE");
  const active=rows.filter(row=>row.status==="active");
  const online=active.filter(row=>launcherOnline(row,now));
  const obs=online.find(row=>row.obs_connected===true);
  const device=obs||online[0]||active[0]||null;
  return {paired:active.length>0,online:online.length>0,obs_connected:Boolean(obs),
    status:obs?"obs_reported":online.length?"launcher_only":active.length?"offline":"not_paired",
    device:device?{machine_name:device.machine_name,client_version:device.client_version,
      last_seen_at:device.last_seen_at}:null};
}
export async function readLauncherEvidence(db,accountId,now=Date.now()){
  const result=await db.query("select machine_name,client_version,status,obs_connected,obs_version,last_seen_at from launcher_devices where account_id=$1 and status='active' order by last_seen_at desc nulls last",[accountId]);
  return launcherEvidence(result.rows,now);
}
export async function readCreatorEvidence(db,accountId,configured,now=Date.now()){
  const [platforms,launcher]=await Promise.allSettled([readProviderCapabilities(db,accountId,configured,now),readLauncherEvidence(db,accountId,now)]);
  return {platforms:platforms.status==="fulfilled"?platforms.value:null,launcher:launcher.status==="fulfilled"?launcher.value:null};
}
export function providerEvidence(platform){
  if(!platform)return "unknown";
  if(!platform.configured)return "not_configured";
  if(platform.connection!=="record_present")return "not_connected";
  if(platform.token_status==="expired")return "expired";
  return "record_present_unverified";
}
export function streamReadiness(evidence,configured){
  const launcher=evidence.launcher;
  const provider=name=>providerEvidence(evidence.platforms?.find(p=>p.provider===name));
  return {ok:true,ready:false,status:"setup_required",checks:{
    twitch:false,tiktok:false,launcher:launcher?.online===true,obs:launcher?.obs_connected===true},
    evidence:{twitch:provider("twitch"),tiktok:provider("tiktok"),launcher:launcher?.status||"unknown",
      bridge_configured:configured.bridge===true,obs_reported:launcher?.obs_connected===true},
    steps:[{key:"launcher",label:"Launcher-Heartbeat",ready:launcher?.online===true,detail:launcher?.online?"Aktueller Heartbeat":"Kein aktueller Heartbeat bestätigt"},
    {key:"obs",label:"OBS-Gerätemeldung",ready:launcher?.obs_connected===true,detail:launcher?.obs_connected?"Vom aktuellen Launcher gemeldet; echter OBS-Test offen":"Keine aktuelle OBS-Meldung"},
    {key:"providers",label:"Plattform-Abnahme",ready:false,detail:"Gespeicherte Verbindungen sind keine bestätigte Live-Berechtigung."}],
    message:"Live-Startfreigabe und echte Geräte-/Provider-Abnahme stehen aus."};
}
export function technicalStatus(evidence,configured,now=Date.now()){
  const l=evidence.launcher,p=evidence.platforms?.find(x=>x.provider==="tiktok");
  const unknown=detail=>({state:"unknown",detail});
  return {ok:true,service:"cfs-zockt",status:"operational_with_setup_requirements",overall:"partial",generated_at:new Date(now).toISOString(),
    checks:{database:true,oauth:configured.tiktok===true||configured.twitch===true,mail:configured.mail===true,paypal:configured.paypal===true,launcher:configured.bridge===true},
    components:{
      website:{state:"ready",detail:"Authentifizierte Status-API hat geantwortet; keine vollständige Website-Abnahme."},
      database:{state:"ready",detail:"Account-Sitzung aus Datenbank gelesen; keine Schema-/Restore-Freigabe."},
      tiktok:{state:"waiting",detail:"Kontostatus: "+providerEvidence(p)+". Provider-Validierung offen.",connected:false,connection_state:providerEvidence(p)},
      launcher:l?{state:l.online?"ready":l.paired?"stale":"waiting",detail:l.obs_connected?"Aktueller Heartbeat meldet OBS; Geräteabnahme offen.":l.online?"Aktueller Heartbeat; OBS nicht bestätigt.":"Kein aktueller Heartbeat.",online:l.online,connection_state:l.status,heartbeat_grace_ms:LAUNCHER_ONLINE_MS,
        heartbeat_age_seconds:l.device?.last_seen_at&&Number.isFinite(new Date(l.device.last_seen_at).getTime())&&new Date(l.device.last_seen_at).getTime()<=now?Math.floor((now-new Date(l.device.last_seen_at).getTime())/1000):null}:unknown("Gerätestatus nicht abrufbar."),
      live:unknown("Kein echter Live-Status durch diese Prüfung bestätigt."),game:unknown("Keine aktuelle Game-Präsenz geprüft."),
      playstation:unknown("PlayStation-Synchronisierung separat prüfen."),discord:unknown("Community-Daten separat prüfen."),
      security:unknown("Security-Konfiguration ist kein Abnahmenachweis."),suite:unknown("Creator-Funktionen separat abnehmen."),
      release:unknown("Produktionsfreigabe nicht erteilt.")}
  };
}
