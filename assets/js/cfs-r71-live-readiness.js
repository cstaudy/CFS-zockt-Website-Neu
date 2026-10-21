/* R72: fail-closed live preflight. No live-event or OBS approval is implied. */
(()=>{'use strict';
const panel=document.getElementById('ub71LivePanel');
if(!panel)return;
const button=document.getElementById('ub71CheckStatus');
const message=document.getElementById('ub71LiveMessage');
const grid=document.getElementById('ub71Providers');
const checked=document.getElementById('ub72CheckedAt');
const STATES=new Set(['not_permitted','disconnected','configuration_required','ready_for_events']);
let pending=false,controller=null,deadline=null,expiry=null,lastCheck=0;
function note(value){message.textContent=value;}
function reset(value){clearTimeout(expiry);expiry=null;lastCheck=0;grid.replaceChildren();if(checked)checked.textContent='';note(value);}
function validData(data){
 if(!data||data.ok!==true||data.contract!=='cfs-live-readiness-v1'||data.kind!=='preflight_only'||data.export_mode!=='offline_zip_is_always_static')return false;
 if(!Array.isArray(data.providers)||data.providers.length!==2)return false;
 const names=data.providers.map(p=>p?.provider).sort();
 if(names[0]!=='tiktok'||names[1]!=='twitch')return false;
 if(data.providers.some(p=>!STATES.has(p?.state)||typeof p.label!=='string'||p.label.length>100||typeof p.detail!=='string'||p.detail.length>500||typeof p.eligible!=='boolean'||typeof p.connected!=='boolean'||
  (p.state==='ready_for_events'&&(!p.connected||!p.eligible))||
  (p.state==='disconnected'&&(p.connected||!p.eligible))||
  (p.state==='configuration_required'&&(!p.connected||!p.eligible))||
  (p.state==='not_permitted'&&p.eligible)))return false;
 if(typeof data.checked_at!=='string')return false;
 const timestamp=Date.parse(data.checked_at);
 // Do not advertise readiness based on old, future-dated or malformed data.
 return Number.isFinite(timestamp)&&timestamp<=Date.now()+30000&&Date.now()-timestamp<=120000;
}
function providerCard(data){
 const row=document.createElement('div');row.className='ub71-provider';
 const name=document.createElement('strong');name.textContent=data.provider==='twitch'?'Twitch':'TikTok';
 const status=document.createElement('span');status.className='ub71-provider-status';status.dataset.state=data.state;
 status.textContent=data.label;
 const description=document.createElement('p');description.textContent=data.detail;
 row.append(name,status,description);grid.append(row);
}
async function refresh(){
 if(pending)return;
 if(navigator.onLine===false){reset('Offline: Keine aktuelle Live-Freigabe bestätigt. Bitte Verbindung prüfen.');return;}
 pending=true;button.disabled=true;reset('Verbindungsstatus wird geprüft …');
 controller=new AbortController();
 deadline=setTimeout(()=>controller?.abort(),10000);
 try{
  const response=await fetch('/api/creator/universal-builder/live-readiness',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
  if(!response.ok)throw Error(response.status===401||response.status===403?'Anmeldung oder Berechtigung prüfen.':'Status zurzeit nicht verfügbar.');
  const data=await response.json();
  if(!validData(data))throw Error('Ungültige oder veraltete Statusantwort.');
  if(navigator.onLine===false)throw Error('Verbindung unterbrochen.');
  data.providers.forEach(providerCard);
  lastCheck=Date.parse(data.checked_at);
  expiry=setTimeout(()=>reset('Status abgelaufen. Bitte erneut prüfen; eine Live-Freigabe ist nicht bestätigt.'),Math.max(1,120000-(Date.now()-lastCheck)));
  if(checked)checked.textContent='Zuletzt geprüft: '+new Date(data.checked_at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+' · Nur Voraussetzungen';
  note('Voraussetzungen geprüft. Dies bestätigt weder aktive Live-Ereignisse noch eine funktionierende OBS-Live-Quelle.');
 }catch(error){
  const reason=error?.name==='AbortError'?'Zeitüberschreitung bei der Prüfung.':String(error?.message||'Verbindung prüfen.');
  reset('Keine Live-Freigabe bestätigt. '+reason);
 }finally{clearTimeout(deadline);deadline=null;controller=null;pending=false;button.disabled=false;}
}
button.addEventListener('click',refresh);
panel.addEventListener('toggle',()=>{if(panel.open&&!grid.childElementCount&&!pending)refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&lastCheck&&Date.now()-lastCheck>=120000)reset('Status abgelaufen. Bitte erneut prüfen; eine Live-Freigabe ist nicht bestätigt.');});
window.addEventListener('offline',()=>{if(controller)controller.abort();reset('Offline: Status zurückgesetzt. Eine Live-Freigabe ist nicht bestätigt.');});
window.addEventListener('online',()=>{reset('Wieder online. Status bitte erneut prüfen; eine Live-Freigabe ist nicht bestätigt.');});
})();
