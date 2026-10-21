/* R106: read-only, truthful public provider snapshot for the compact dashboard. */
(()=>{'use strict';
 if(location.pathname!=='/pages/dashboard.html')return;
 const channels=['twitch','tiktok'];
 function label(key){return key==='twitch'?'Twitch':'TikTok';}
 function update(key,data,failed=false){
   const name=key==='twitch'?'Twitch':'TikTok';
   const status=document.getElementById(`r106${name}Status`);
   const detail=document.getElementById(`r106${name}Detail`);
   if(!status||!detail)return;
   const connected=data?.connected===true;
   const confirmed=data?.authoritative===true&&data?.stale!==true&&data?.available!==false;
   const state=String(data?.status||'unknown').toLowerCase();
   status.classList.remove('is-live','is-offline','is-pending');
   if(confirmed&&state==='live'){
     status.textContent='● Live';status.classList.add('is-live');
     detail.textContent='LIVE-Signal vom Anbieter bestätigt';
   }else if(confirmed&&state==='offline'){
     status.textContent='● Offline';status.classList.add('is-offline');
     detail.textContent='Derzeit kein bestätigter Livestream';
   }else if(!failed&&!connected&&data?.connected===false){
     status.textContent='Nicht verbunden';status.classList.add('is-pending');
     detail.textContent='Keine bestätigte Anbieter-Verbindung';
   }else{
     status.textContent='Status offen';status.classList.add('is-pending');
     detail.textContent=failed?'Live-Abfrage momentan nicht verfügbar':'Kein eindeutiges LIVE-Signal vorhanden';
   }
 }
 async function load(){
   const hint=document.getElementById('r106LiveHint');
   try{
     const response=await fetch('/api/public/live-session',{headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store'});
     if(!response.ok)throw new Error(`HTTP ${response.status}`);
     const payload=await response.json();
     if(payload?.ok===false)throw new Error('Live snapshot unavailable');
     for(const key of channels)update(key,payload?.channels?.[key]||{});
     if(hint)hint.textContent='Aktualisierte LIVE-Signale der verbundenen Plattformen. Unbekannt bleibt unbekannt.';
   }catch{
     for(const key of channels)update(key,{},true);
     if(hint)hint.textContent='LIVE-Daten sind vorübergehend nicht erreichbar. Es wird kein Offline-Status behauptet.';
   }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
