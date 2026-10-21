(function(){
"use strict";
const app=document.getElementById("builderApp");if(!app)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const state={data:null,step:"design",design:null,platforms:["obs"],widgetPlatform:"obs",elements:[],activeId:null,format:"landscape",bundleId:null,bundleVersion:null,showAllDesigns:false,saving:false,exporting:false,lastError:null,lastExportError:null};
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const clone=value=>JSON.parse(JSON.stringify(value));
// R68: the core owns persisted design, selection and stage; UIs subscribe to changes.
// R94: bounded, local-only edit history. Never roll back a server bundle version.
const undoState={states:[],index:-1,restoring:false,lastKind:'',lastAt:0};
function editSnapshot(){return JSON.stringify({design:state.design,platforms:state.platforms,elements:state.elements,settings:state.data?.settings||{},activeId:state.activeId});}
function resetHistory(){undoState.states=[editSnapshot()];undoState.index=0;undoState.lastKind='';undoState.lastAt=0;}
function historyStatus(){return {canUndo:undoState.index>0,canRedo:undoState.index>=0&&undoState.index<undoState.states.length-1};}
function notifyChange(kind){
 if(state.data&&!undoState.restoring){
  if(undoState.index<0||['open','template','clear'].includes(kind))resetHistory();
  else if(!['select','refresh','saved','removed-bundle','assets','undo','redo'].includes(kind)){
   const next=editSnapshot(),prev=undoState.states[undoState.index];
   if(next!==prev){
    const now=Date.now(),coalesce=['element','settings','palette'].includes(kind)&&undoState.lastKind===kind&&(now-undoState.lastAt)<500&&undoState.index>0;
    if(coalesce){undoState.states[undoState.index]=next;}
    else{undoState.states=undoState.states.slice(0,undoState.index+1);undoState.states.push(next);undoState.index++;}
    if(undoState.states.length>51){undoState.states.shift();undoState.index--;}
    undoState.lastKind=kind;undoState.lastAt=now;
   }
  }
 }
 window.dispatchEvent(new CustomEvent("cfs:builder-changed",{detail:{kind,history:historyStatus()}}));
}
function travelHistory(delta){
 const index=undoState.index+delta;if(!state.data||index<0||index>=undoState.states.length)return false;
 const saved=JSON.parse(undoState.states[index]);undoState.restoring=true;
 try{
  state.design=saved.design;state.platforms=clone(saved.platforms);state.elements=clone(saved.elements);
  state.data.settings=clone(saved.settings);state.activeId=state.elements.some(x=>x.id===saved.activeId)?saved.activeId:state.elements.at(-1)?.id||null;
  undoState.index=index;undoState.lastKind='';renderDesigns();renderPlatforms();renderWidgetPlatform();renderWidgets();renderContent();renderPreview();
 }finally{undoState.restoring=false;}
 notifyChange(delta<0?'undo':'redo');return true;
}

function message(text,type="ok"){const el=$("#ubMessage");el.textContent=text;el.hidden=!text;el.className=`notice ${type==="error"?"ub-message-error":"ub-message-ok"}`;}
function selectedDesign(){return state.data?.designs?.find(x=>x.key===state.design)||state.data?.designs?.[0]||{key:"blitze",label:"Blitze",accent:"#20c7ff",second:"#8be9ff",surface:"#071827"};}
function activeElement(){return state.elements.find(x=>x.id===state.activeId)||state.elements.at(-1)||null;}
function friendlyApiError(status,data,fallback){
 const msg=String(data?.error||fallback||"Vorgang fehlgeschlagen.");
 if(status===401)return new Error("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an und öffne den Builder wieder.");
 if(status===403)return new Error("Keine Berechtigung: "+msg);
 if(status===409)return new Error("Versionskonflikt: Dieses Design wurde in einer anderen Sitzung geändert. Dein aktueller Entwurf bleibt erhalten. Prüfe unter „Meine Designs“ den neuesten Stand, bevor du erneut speicherst.");
 if(status===413)return new Error("Die Datei ist zu groß. Bitte wähle eine kleinere Datei.");
 if(status===415)return new Error("Das Dateiformat wird nicht unterstützt. Bitte PNG, JPG oder WebP verwenden.");
 if(status>=500)return new Error("Der Server ist vorübergehend nicht erreichbar. Dein Entwurf bleibt im Editor; bitte später erneut versuchen.");
 return new Error(msg);
}
// R102: only a confirmed 401 expires this editor. Never let another user's
// already-rendered designs or private media remain visible in an open tab.
function expireBuilderSession(){
 if(!state.data)return;
 // Preserve a sanitized pending draft before clearing the authenticated view.
 window.dispatchEvent(new CustomEvent('cfs:builder-session-ending'));
 state.data=null;state.elements=[];state.activeId=null;state.bundleId=null;state.bundleVersion=null;
 state.platforms=['obs'];state.widgetPlatform='obs';undoState.states=[];undoState.index=-1;
 for(const id of ['ubSavedBundles','ubAssetShelf','ubStage','ubWidgetGrid','ubContentList']){
  const el=document.getElementById(id);if(el)el.replaceChildren();
 }
 const status=document.getElementById('ubStatus');if(status)status.textContent='Sitzung abgelaufen – bitte neu anmelden.';
 window.dispatchEvent(new CustomEvent('cfs:builder-session-expired'));
}
async function readApiResponse(response,fallback){
 let data;
 try{data=await response.json();}catch{data=null;}
 if(!response.ok){
  if(response.status===401)expireBuilderSession();
  throw friendlyApiError(response.status,data,fallback);
 }
 // A broken proxy may answer 200 with HTML, an empty JSON document or
 // {ok:false}. Do not mistake any of those for a valid empty design list.
 if(!data||typeof data!=='object'||Array.isArray(data)||data.ok!==true)
  throw new Error('Ungültige Serverantwort. Vorhandene Designs wurden nicht überschrieben. Bitte erneut versuchen.');
 return data;
}
// R103: a 2xx status and {ok:true} are not enough to prove persistence.
// Reject partial/mismatched responses before changing local IDs, versions or lists.
function persistedBundleOrThrow(bundle,{id=null,previousVersion=null}={}){
 const valid=bundle&&typeof bundle==='object'&&!Array.isArray(bundle)
   &&typeof bundle.id==='string'&&bundle.id.trim()&&bundle.id.length<=100
   &&typeof bundle.name==='string'&&bundle.name.trim()
   &&Number.isSafeInteger(bundle.version)&&bundle.version>0
   &&typeof bundle.design_key==='string'&&bundle.design_key.length>0
   &&Array.isArray(bundle.platforms)&&bundle.platforms.length>0
   &&Array.isArray(bundle.elements)&&bundle.elements.length<=24
   &&bundle.settings&&typeof bundle.settings==='object'&&!Array.isArray(bundle.settings);
 if(!valid||(id!==null&&bundle.id!==id)
   ||(previousVersion!==null&&bundle.version<=previousVersion)){
  throw new Error('Unvollständige Speicherbestätigung. Der aktuelle Entwurf bleibt unverändert. Bitte Designliste prüfen, bevor du erneut speicherst.');
 }
 return bundle;
}
function readableError(error){
 if(error instanceof TypeError)return new Error("Keine Netzwerkverbindung. Dein Entwurf bleibt im Editor; bitte Verbindung prüfen und erneut versuchen.");
 return error instanceof Error?error:new Error(String(error||"Unbekannter Fehler"));
}
function config(){return{design_key:state.design,platforms:state.platforms,elements:clone(state.elements),settings:clone(state.data.settings||{})};}
// R70: portable backups are explicit data-only documents. Never serialize private URLs, tokens or asset IDs.
const PORTABLE_SCHEMA="cfs-creator-design-v1";
const PORTABLE_TYPES=new Set(["starting","pause","ending","offline","countdown","schedule","social_bar","ticker","sponsor","camera_frame","panels","text","image","counter","goal","alert","chat","event_feed"]);
const safePlain=(value,max)=>String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").slice(0,max);
function portableConfig(row){
 const elements=(row.elements||[]).map((e,i)=>({id:safePlain(e.id||`element_${i}`,80),type:e.type,platform:e.platform,source_key:safePlain(e.source_key,100),widget_type:safePlain(e.widget_type,100),label:safePlain(e.label,120),text:safePlain(e.text,180),subtitle:safePlain(e.subtitle,180),goal:Math.max(0,Math.min(1000000000,Math.round(Number(e.goal)||0))),metric:safePlain(e.metric,80),enabled:e.enabled!==false,locked:e.locked===true,group_id:safePlain(e.group_id||"",80).match(/^r97_[a-z0-9_-]{1,72}$/i)?.[0]||"",position:{x:Number(e.position?.x)||0,y:Number(e.position?.y)||0},size:{width:Number(e.size?.width)||640,height:Number(e.size?.height)||120}}));
 const settings={};for(const key of ["channel_name","subtitle","accent","text_color","background","transparency","font_family","font_size","font_weight","animation","animation_speed","format","width","height"]){if(row.settings&&row.settings[key]!==undefined)settings[key]=row.settings[key];}
 return {design_key:row.design_key,platforms:clone(row.platforms||["obs"]),elements,settings};
}
function portableDocument(row){
 const omitted=(row.elements||[]).filter(e=>e.asset_id||e.source_url).length+Number(!!row.settings?.logo_source)+Number(!!row.settings?.background_source);
 return {schema:PORTABLE_SCHEMA,version:1,name:safePlain(row.name||"Mein Design",140),exported_at:new Date().toISOString(),media_omitted:omitted,notice:"Lokale JSON-Designkopie ohne Medien-IDs, private URLs oder Anmeldedaten. Bilder und Live-Verbindungen nach Import neu zuordnen.",config:portableConfig(row)};
}
function validatePortable(doc){
 if(!doc||doc.schema!==PORTABLE_SCHEMA||doc.version!==1||!doc.config||typeof doc.config!=="object")throw Error("Datei ist kein unterstütztes CFS-Designpaket (Version 1).");
 const cfg=doc.config;
 if(typeof doc.name!=="string"||!doc.name.trim()||doc.name.length>140)throw Error("Ungültiger Designname im Backup.");
 if(!state.data.designs?.some(d=>d.key===cfg.design_key))throw Error("Diese Designwelt ist in deinem Konto nicht verfügbar.");
 const access=new Set((state.data.platforms||[]).map(p=>p.key));
 if(!Array.isArray(cfg.platforms)||!cfg.platforms.length||cfg.platforms.length>3||cfg.platforms.some(p=>!access.has(p)))throw Error("Plattform des Backups ist nicht verfügbar.");
 if(!Array.isArray(cfg.elements)||!cfg.elements.length||cfg.elements.length>24)throw Error("Ein Design benötigt 1 bis 24 Elemente.");
 const ids=new Set(),reg=new Set((state.data.registry||[]).filter(r=>r.available!==false).map(r=>(r.provider||"obs")+"|"+r.key));
 for(const e of cfg.elements){
  if(!e||typeof e!=="object"||!PORTABLE_TYPES.has(e.type)||typeof e.id!=="string"||!e.id||e.id.length>80||ids.has(e.id))throw Error("Elementdefinition im Backup ist ungültig oder doppelt.");
  ids.add(e.id);
  if(!cfg.platforms.includes(e.platform))throw Error("Elementplattform und Designplattform stimmen nicht überein.");
  if(e.platform!=="obs"&&!reg.has(e.platform+"|"+e.widget_type))throw Error("Für ein Live-Element fehlt die erforderliche Berechtigung.");
  if(e.asset_id||e.source_url)throw Error("Backup enthält private Asset-Referenzen und kann nicht importiert werden.");
 }
 if(!cfg.settings||typeof cfg.settings!=="object"||Array.isArray(cfg.settings))throw Error("Designeinstellungen fehlen.");
 if(cfg.settings.logo_source||cfg.settings.background_source)throw Error("Backup enthält private Medien-URLs.");
 if(!["landscape","vertical","square"].includes(cfg.settings.format))throw Error("Ausgabeformat im Backup ist ungültig.");
 return {name:doc.name.trim(),config:portableConfig(cfg),mediaOmitted:Number(doc.media_omitted)||0};
}
async function createCopy(row,name){
 const response=await fetch("/api/creator/universal-builder/bundles",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,config:{design_key:row.design_key,platforms:row.platforms,elements:row.elements,settings:row.settings}})});
 const result=await readApiResponse(response,"Design konnte nicht kopiert werden.");
 const confirmed=persistedBundleOrThrow(result.bundle);
 state.data.bundles=[confirmed,...(state.data.bundles||[]).filter(x=>x.id!==confirmed.id)];
 renderSavedBundles();notifyChange("saved");window.dispatchEvent(new CustomEvent("cfs:builder-saved"));
 return result.bundle;
}

function setStep(step){state.step=step;$$('[data-panel]').forEach(p=>p.classList.toggle("active",p.dataset.panel===step));$$('[data-step]').forEach(b=>b.classList.toggle("active",b.dataset.step===step));if(step==="content")renderContent();if(step==="preview")renderPreview();window.scrollTo({top:0,behavior:"smooth"});}
function renderDesigns(){const grid=$("#ubDesignGrid"),designs=state.data.designs||[],visible=state.showAllDesigns?designs:designs.filter((d,i)=>i<6||d.key===state.design);$("#ubDesignCount").textContent=`${designs.length} Looks`;const toggle=$("#ubDesignMore");if(toggle){toggle.hidden=designs.length<=6;toggle.textContent=state.showAllDesigns?"WENIGER DESIGNS ANZEIGEN":`ALLE ${designs.length} DESIGNS ANZEIGEN`;toggle.setAttribute("aria-expanded",String(state.showAllDesigns))}grid.innerHTML=visible.map(d=>`<button class="ub-design-card ${d.key===state.design?"active":""}" data-design="${esc(d.key)}"><div class="ub-design-swatch" style="--accent:${esc(d.accent)};--second:${esc(d.second)};background:${esc(d.surface)}"><i></i><b>${esc(d.key.toUpperCase())}</b></div><div class="ub-design-copy"><strong>${esc(d.label)}</strong><small>${esc(d.description)}</small></div></button>`).join("");$$('[data-design]',grid).forEach(b=>b.onclick=()=>{state.design=b.dataset.design;renderDesigns();renderContent();renderPreview();notifyChange("theme");});}
function renderPlatforms(){const grid=$("#ubPlatformGrid");grid.innerHTML=(state.data.platforms||[]).map(p=>`<button class="ub-platform-card ${state.platforms.includes(p.key)?"active":""}" data-platform="${esc(p.key)}"><b>${esc(p.short_label)}</b><strong>${esc(p.label)}</strong><small>${p.kind==="live"?"Normalisierte LIVE-Events und Provider-Adapter.":"Stream- und OBS-Elemente ohne Plattformbindung."}</small></button>`).join("");$$('[data-platform]',grid).forEach(b=>b.onclick=()=>{const key=b.dataset.platform;if(state.platforms.includes(key)){if(state.platforms.length>1)state.platforms=state.platforms.filter(x=>x!==key);}else state.platforms.push(key);state.widgetPlatform=state.platforms[0]||"obs";renderPlatforms();renderWidgetPlatform();renderWidgets();notifyChange("platforms");});}
function platformLabel(key){return state.data.platforms?.find(x=>x.key===key)?.label||key;}
function typeFor(def){if(["text","social_bar","sponsor","starting","pause","ending"].includes(def.key))return def.key;if(def.key==="image")return"image";if(def.key==="ticker")return"ticker";if(def.key==="schedule")return"schedule";if(def.mode==="goal"||def.mode==="goal_alert")return"goal";if(def.mode==="alert"||def.mode==="latest")return"alert";if(def.mode==="chat")return"chat";if(def.mode==="timer"||def.mode==="manual_timer")return"countdown";if(def.mode==="static")return def.static_kind==="screen"?"starting":def.static_kind==="camera"?"camera_frame":"image";return"counter";}
function renderWidgetPlatform(){const select=$("#ubWidgetPlatform");select.innerHTML=state.platforms.map(k=>`<option value="${esc(k)}">${esc(platformLabel(k))}</option>`).join("");select.value=state.widgetPlatform;select.onchange=()=>{state.widgetPlatform=select.value;renderWidgets();};}
function availableWidgets(){const platform=state.widgetPlatform;const general=[
 {key:"starting",label:"Starting Soon",description:"Allgemeines Stream-Element",mode:"static",provider:"obs",static_kind:"screen"},
 {key:"pause",label:"Pause Screen",description:"Allgemeines Stream-Element",mode:"static",provider:"obs",static_kind:"screen"},
 {key:"ending",label:"Stream Ending",description:"Allgemeines Stream-Element",mode:"static",provider:"obs",static_kind:"screen"},
 {key:"social_bar",label:"Social Bar",description:"Allgemeine Branding-Leiste",mode:"static",provider:"obs",static_kind:"social_bar"},
 {key:"sponsor",label:"Sponsor",description:"Allgemeines Sponsor-Element",mode:"static",provider:"obs",static_kind:"header"},
 {key:"text",label:"Eigenes Text-Widget",description:"Plattformneutrales Text-Element",mode:"manual",provider:"obs"},
 {key:"image",label:"Bild / Logo",description:"Plattformneutrales Bild-Element",mode:"manual",provider:"obs"},
 {key:"camera_frame",label:"Kamera-Markierung (statisch)",description:"Kamerabereich – ohne Freistellung",mode:"static",static_kind:"camera",provider:"obs"},
 {key:"manual_goal",label:"Manuelles Ziel",description:"Zahl ohne automatische Live-Aktualisierung",mode:"goal",provider:"obs"},
 {key:"ticker",label:"Infoticker (statisch)",description:"Fester Text, kein Live-Feed",mode:"static",static_kind:"ticker",provider:"obs"},
 {key:"schedule",label:"Streamplan (statisch)",description:"Manuell bearbeitbarer Wochenplan",mode:"static",static_kind:"schedule",provider:"obs"}
 ];
 const live=(state.data.registry||[]).filter(x=>x.provider===platform&&x.available!==false);return platform==="obs"?[...general,...live]:live;}
function renderWidgets(){const grid=$("#ubWidgetGrid"),items=availableWidgets();grid.innerHTML=items.map(d=>{const selected=state.elements.some(x=>x.widget_type===d.key||x.source_key===d.key||x.id===d.key);return `<button class="ub-widget-card ${selected?"active":""}" data-widget="${esc(d.key)}"><strong>${esc(d.label)}</strong><small>${esc(d.description||"Stream-Element")}</small><em>${esc(d.provider==="obs"?"ALLGEMEIN":String(d.provider||state.widgetPlatform).toUpperCase())}</em></button>`}).join("");$$('[data-widget]',grid).forEach(b=>b.onclick=()=>addWidget(b.dataset.widget));renderSelection();}
function addWidget(key){
 // R100: enforce the same 24-element limit in the legacy editor and the shared bridge.
 if(!state.data||state.elements.length>=24){message("Maximal 24 Elemente pro Design. Bitte zuerst eine Ebene entfernen.","error");return false;}
 const def=[...(state.data.registry||[]),...availableWidgets()].find(x=>x.key===key)||{key,label:key,mode:"manual",provider:state.widgetPlatform};const id=`${key}_${typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():`${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`}`;const known=(state.data.registry||[]).some(x=>x.key===def.key);const item={id,type:typeFor(def),platform:def.provider||state.widgetPlatform,source_key:def.key,widget_type:known?def.key:"",label:def.label||key,text:def.label||key,subtitle:"",goal:Number(def.default_goal||1000),metric:def.metric||"",enabled:true,position:{x:0,y:0},size:{width:640,height:120}};if(isR69Layout(stageModel())){
 const fmt=state.data.settings?.format||'landscape',wh={landscape:[1920,1080],vertical:[1080,1920],square:[1080,1080]}[fmt]||[1920,1080];
 item.position={x:80,y:Math.min(820,280+(state.elements.length%4)*130)};
 item.size={width:Math.round(wh[0]*.58),height:Math.round(wh[1]*.13)};
 }
 state.elements.push(item);state.activeId=id;renderWidgets();setStep("content");notifyChange("add");return true;}
function renderSelection(){const list=$("#ubSelectionList");$("#ubSelectionCount").textContent=`${state.elements.length} Elemente`;$("#ubWidgetPrice").textContent=priceLabel(state.elements.length);list.innerHTML=state.elements.length?state.elements.map(x=>`<div class="ub-selection-item"><button class="ub-selection-open" data-select="${esc(x.id)}">${esc(x.label)}</button><button data-remove="${esc(x.id)}" aria-label="Element entfernen">×</button></div>`).join(""):"<small style=\"color:#8299ac\">Noch keine Elemente ausgewählt.</small>";$$('[data-select]',list).forEach(b=>b.onclick=()=>{state.activeId=b.dataset.select;setStep("content");renderContent();notifyChange("select");});$$('[data-remove]',list).forEach(b=>b.onclick=()=>{if(state.elements.find(e=>e.id===b.dataset.remove)?.locked===true){message("Gesperrtes Element zuerst entsperren.","error");return;}state.elements=state.elements.filter(x=>x.id!==b.dataset.remove);if(state.activeId===b.dataset.remove)state.activeId=state.elements.at(-1)?.id||null;renderWidgets();renderContent();renderPreview();notifyChange("remove");});}
function priceLabel(count){const cents=count<=5?0:count===6?99:count===7?149:count===8?199:count===9?249:count<=12?399:499;return cents?`${(cents/100).toFixed(2).replace(".",",")} €`:"0,00 €";}
function renderContent(){const item=activeElement(),settings=state.data.settings||{};$("#ubActiveElement").textContent=item?`${item.label} · ${platformLabel(item.platform)}`:"Wähle links ein Element aus.";$("#ubElementText").value=item?.text||"";$("#ubElementSubtitle").value=item?.subtitle||"";$("#ubElementGoal").value=item?.goal??0;$("#ubElementMetric").value=item?.metric||"";$("#ubAccent").value=toColor(settings.accent,"#20c7ff");$("#ubTextColor").value=toColor(settings.text_color,"#f4f8ff");$("#ubBackground").value=toColor(settings.background,"#071827");$("#ubFont").value=settings.font_family||"Inter";$("#ubAnimation").value=settings.animation||"soft";$("#ubChannel").value=settings.channel_name||"";$$('[data-format]').forEach(b=>b.classList.toggle("active",b.dataset.format===(settings.format||"landscape")));renderMiniPreview();}
function toColor(value,fallback){return /^#[0-9a-f]{6}$/i.test(String(value||""))?value:fallback;}
function bindContent(){const field=(id,fn)=>{const el=$(id);el.oninput=()=>{const item=activeElement();if(id!=="#ubChannel"&&(!item||item.locked===true)){if(item?.locked)message("Gesperrtes Element zuerst entsperren.","error");return;}fn(item,el.value);renderMiniPreview();notifyChange(id==="#ubChannel"?"settings":"element");};};field("#ubElementText",(i,v)=>i.text=v);field("#ubElementSubtitle",(i,v)=>i.subtitle=v);field("#ubElementGoal",(i,v)=>i.goal=Math.max(0,Number(v)||0));field("#ubElementMetric",(i,v)=>i.metric=v);field("#ubChannel",(_,v)=>state.data.settings.channel_name=v);[["#ubAccent","accent"],["#ubTextColor","text_color"],["#ubBackground","background"],["#ubFont","font_family"],["#ubAnimation","animation"]].forEach(([id,key])=>$(id).oninput=()=>{state.data.settings[key]=$(id).value;renderMiniPreview();notifyChange("settings");});$$('[data-format]').forEach(b=>b.onclick=()=>{state.data.settings.format=b.dataset.format;renderContent();notifyChange("settings");});}
function renderAssetShelf(){const shelf=$("#ubAssetShelf");if(!shelf)return;const assets=(state.data.assets||[]).filter(a=>a.media_type==="image"||a.media_type==="video").slice(0,8);shelf.innerHTML=assets.length?assets.map(a=>`<button type="button" class="ub-asset-chip" draggable="true" data-asset-id="${esc(a.id)}"><span>${a.media_type==="image"?"▧":"▶"}</span><strong>${esc(a.name||a.original_name||"Datei")}</strong><small>${esc(String(a.format||"").toUpperCase())}</small></button>`).join(""):"<small class=\"ub-asset-empty\">Noch keine Dateien in der Medienbibliothek.</small>";$$('[data-asset-id]',shelf).forEach(b=>{b.onclick=()=>applyBuilderAsset((state.data.assets||[]).find(a=>a.id===b.dataset.assetId));b.ondragstart=e=>e.dataTransfer.setData("text/cfs-asset-id",b.dataset.assetId);});}
function applyBuilderAsset(asset){if(!asset)return;const target=$("#ubAssetTarget")?.value||"active_element";const settings=state.data.settings||{};if(target==="logo_source")settings.logo_source=asset.url;else if(target==="background_source")settings.background_source=asset.url;else{let item=activeElement();if(!item||item.type!=="image"){item={id:`image_${Date.now().toString(36)}`,type:"image",platform:"obs",source_key:"image",widget_type:"",label:asset.name||"Eigenes Bild",text:asset.name||"Eigenes Bild",subtitle:"",goal:0,metric:"",enabled:true,position:{x:0,y:0},size:{width:640,height:360}};state.elements.push(item);state.activeId=item.id;}item.type="image";item.asset_id=asset.id;item.source_url=asset.url;item.text=asset.name||"Eigenes Bild";}renderAssetShelf();renderContent();renderPreview();notifyChange("asset");message(`${asset.name||"Datei"} wurde als ${target==="logo_source"?"Logo":target==="background_source"?"Hintergrund":"Bild-Element"} übernommen.`);}
async function uploadBuilderAsset(file,{apply=true}={}){if(!file)return;try{const response=await fetch("/api/creator/widget-studio/assets",{method:"POST",credentials:"same-origin",headers:{"Content-Type":file.type||"application/octet-stream","X-CFS-File-Name":encodeURIComponent(file.name)},body:file});const data=await readApiResponse(response,"Datei konnte nicht hochgeladen werden.");const asset=data.asset;if(asset){const index=(state.data.assets||[]).findIndex(x=>x.id===asset.id);if(index>=0)state.data.assets[index]=asset;else state.data.assets.unshift(asset);if(apply)applyBuilderAsset(asset);notifyChange("assets");message(data.duplicate?"Datei war bereits in deiner Medienbibliothek.":`${asset.name} wurde in die Medienbibliothek übernommen.`);return asset;}}catch(error){state.lastError=readableError(error);message(state.lastError.message,"error");}return null;}
function bindFileDock(){const zone=$("#ubDropzone"),input=$("#ubFileInput"),choose=$("#ubChooseFiles");if(!zone||!input)return;choose.onclick=()=>input.click();input.onchange=()=>Array.from(input.files||[]).forEach(uploadBuilderAsset);["dragenter","dragover"].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();zone.classList.add("dragover")}));["dragleave","drop"].forEach(type=>zone.addEventListener(type,e=>{e.preventDefault();zone.classList.remove("dragover")}));zone.ondrop=e=>{const assetId=e.dataTransfer.getData("text/cfs-asset-id");if(assetId){applyBuilderAsset((state.data.assets||[]).find(a=>a.id===assetId));return;}Array.from(e.dataTransfer.files||[]).forEach(uploadBuilderAsset)};zone.onkeydown=e=>{if(e.key==="Enter"||e.key===" ")input.click();};renderAssetShelf();}
// One serializable model feeds both the visible stage and its static ZIP equivalent.
function stageModel(){return {design:clone(selectedDesign()),settings:clone(state.data?.settings||{}),elements:clone(state.elements)};}
function isR69Layout(model){return (model.elements||[]).some(x=>/^r69_/.test(String(x.id||"")));}
function stageMarkup(model=stageModel(),assetUrl=url=>url){
 const d=model.design,s=model.settings||{},items=(model.elements||[]).filter(x=>x.enabled!==false);
 const dimension={landscape:[1920,1080],vertical:[1080,1920],square:[1080,1080]}[s.format]||[1920,1080];
 const composed=isR69Layout(model);
 const itemPosition=x=>{
  if(!composed)return '';
  const val=(n,limit)=>Math.max(0,Math.min(limit,Number(n)||0));
  const left=val(x.position?.x,1000)/10,top=val(x.position?.y,1000)/10;
  const width=val(x.size?.width,dimension[0])/dimension[0]*100,height=val(x.size?.height,dimension[1])/dimension[1]*100;
  return ` style="left:${left}%;top:${top}%;width:${width}%;height:${height}%"`;
 };
 return `<div class="ub-stage-bg"></div><div class="ub-stage-channel">${esc(s.channel_name||"CFS ZOCKT")}</div><div class="ub-stage-title">${esc(String(d.label||"Design").toUpperCase())} · ${esc(items.length?"STREAM BUNDLE":"DEIN STREAM")}</div>${items.map(x=>{const src=x.source_url?assetUrl(x.source_url):"";if(x.type==="image"&&x.source_key==="original_design_png")return `<div class="ub-stage-item ub-original-layer" data-ub-type="image" data-ub-id="${esc(x.id)}"${itemPosition(x)}>${src?`<img src="${esc(src)}" class="ub-stage-asset" alt="${esc(x.label)}">`:""}</div>`;if(x.source_key==='r92_manual_goal'){
 const target=Math.max(1,Math.min(1000000000,Math.round(Number(x.goal)||1)));
 const current=Math.max(0,Math.min(target,Math.round(Number(x.metric)||0)));
 const percent=Math.round(current/target*10000)/100;
 return `<div class="ub-stage-item ub-r92-goal" data-ub-type="goal" data-ub-id="${esc(x.id)}"${itemPosition(x)}><div><strong>${esc(x.text||'Community-Ziel')}</strong><small>${esc(x.subtitle||'Manueller Stand · nicht live')}</small><div class="ub-r92-progress" role="progressbar" aria-label="${esc(x.text||'Community-Ziel')}" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${current}"><span style="width:${percent}%"></span></div></div><strong>${current} / ${target}</strong></div>`;
 }
 if(x.source_key==='r92_static_countdown')return `<div class="ub-stage-item ub-r92-countdown" data-ub-type="countdown" data-ub-id="${esc(x.id)}"${itemPosition(x)}><div><strong>${esc(x.subtitle||'Countdown · statische Momentaufnahme')}</strong><small>Keine automatische Zeitmessung im Offline-ZIP</small></div><strong class="ub-r92-clock">${esc(x.text||'05:00')}</strong></div>`;
 if(x.source_key==='r92_manual_ticker')return `<div class="ub-stage-item ub-r92-ticker" data-ub-type="ticker" data-ub-id="${esc(x.id)}"${itemPosition(x)}><div><strong>${esc(x.text||'Willkommen im Stream')}</strong><small>Manuelle Textmeldung · statisch</small></div></div>`;
 return `<div class="ub-stage-item" data-ub-type="${esc(x.type)}" data-ub-id="${esc(x.id)}"${itemPosition(x)}>${src?(x.type==="video"?`<video src="${esc(src)}" class="ub-stage-asset" muted autoplay loop playsinline></video>`:`<img src="${esc(src)}" alt="" class="ub-stage-asset">`):""}<div><strong>${esc(x.text||x.label)}</strong><small>${esc(x.subtitle||x.metric||platformLabel(x.platform))}</small></div>${composed?(["goal","counter"].includes(x.type)?`<strong class="ub-stage-value">${esc(String(x.goal??0))}</strong>`:""):`<strong>${x.goal?esc(String(x.goal)):esc(String(x.type||"WIDGET").toUpperCase())}</strong>`}</div>`}).join("")||"<div class=\"ub-stage-item\"><div><strong>Füge dein erstes Element hinzu</strong><small>Preview wird live aktualisiert</small></div></div>"}`;
}
function stageStyle(settings,design){
 const s=settings||{},d=design||selectedDesign();
 const fmt=["landscape","vertical","square"].includes(s.format)?s.format:"landscape";
 const motion=["none","soft","pulse","glow","slide","pop"].includes(s.animation)?s.animation:"none";
 const font=["Inter","system-ui","Arial","Verdana","Trebuchet MS"].includes(s.font_family)?s.font_family:"Inter";
 const speed=Math.max(.25,Math.min(3,Number(s.animation_speed)||1));
 return {format:fmt,motion,font,speed,accent:toColor(s.accent,d.accent||"#20c7ff"),second:toColor(d.second,"#8be9ff"),text:toColor(s.text_color,"#f4f8ff"),background:Number(s.transparency)===1?"transparent":toColor(s.background,d.surface||"#071827")};
}
function applyStageStyle(stage,model){const v=stageStyle(model.settings,model.design);stage.className=`ub-stage cfs-r67-stage ${isR69Layout(model)?"cfs-r69-layout ":""}${v.format}`;stage.dataset.motion=v.motion;stage.dataset.canvas=isR69Layout(model)&&Number(model.settings.transparency)===1?"overlay":"screen";stage.style.cssText=`--motion-speed:${v.speed};--accent:${v.accent};--second:${v.second};--text:${v.text};--stage-font:${v.font};background:${v.background}`;}

function renderStageInto(stage,model=stageModel()){
 if(!stage||!state.data)return false;
 applyStageStyle(stage,model);
 stage.innerHTML=stageMarkup(model);
 return true;
}
function renderMiniPreview(){const el=$("#ubMiniPreview");el.innerHTML='<div class="ub-stage cfs-r67-stage"></div>';renderStageInto(el.firstElementChild);}
function renderPreview(){renderStageInto($("#ubStage"));$("#ubExportElements").textContent=`${state.elements.length} Elemente`;$("#ubExportPrice").textContent=priceLabel(state.elements.length);$("#ubBundleName").value=$("#ubBundleName").value||"Mein Creator Bundle";renderSavedBundles();}
function renderSavedBundles(){const list=$("#ubSavedBundles"),rows=state.data.bundles||[];list.innerHTML=rows.length?`<small>GESPEICHERTE BUNDLES</small>`+rows.slice(0,5).map(x=>`<article><strong>${esc(x.name)}</strong><button data-load-bundle="${esc(x.id)}">ÖFFNEN</button></article>`).join(""):"";$$('[data-load-bundle]',list).forEach(b=>b.onclick=()=>loadBundle(b.dataset.loadBundle));}
function applyBundle(row){state.bundleId=row.id;state.bundleVersion=row.version;state.design=row.design_key;state.platforms=clone(row.platforms||["obs"]);state.widgetPlatform=state.platforms[0]||"obs";state.elements=clone(row.elements||[]);state.activeId=state.elements.at(-1)?.id||null;state.data.settings=clone(row.settings||{});renderDesigns();renderPlatforms();renderWidgetPlatform();renderWidgets();setStep("preview");message(`„${row.name}“ geladen.`);$("#ubBundleName").value=row.name;notifyChange("open");}
async function loadBundle(id){const row=(state.data.bundles||[]).find(x=>x.id===id);if(row)applyBundle(row);}
function resetBundle(){
 if(state.saving)return;
 if(state.elements.length&&!window.confirm("Neues Bundle starten? Nicht gespeicherte Änderungen gehen verloren. Gespeicherte Bundles bleiben erhalten."))return;
 state.bundleId=null;state.bundleVersion=null;state.elements=[];state.activeId=null;
 const name=$("#ubBundleName");if(name)name.value="Mein Creator Bundle";
 renderDesigns();renderWidgets();renderContent();setStep("design");notifyChange("clear");message("Neues leeres Bundle. Bestehende gespeicherte Bundles bleiben erhalten.");
}
async function saveBundle(){
 if(state.saving)return;
 if(!state.elements.length||state.elements.length>24){message("Zum Speichern sind 1 bis 24 Elemente erlaubt.","error");if(!state.elements.length)setStep("widget");return}
 state.saving=true;const button=$("#ubSaveBundle");if(button)button.disabled=true;
 const name=$("#ubBundleName").value.trim()||"Mein Creator Bundle";
 const url=state.bundleId?`/api/creator/universal-builder/bundles/${encodeURIComponent(state.bundleId)}`:"/api/creator/universal-builder/bundles";
 const method=state.bundleId?"PUT":"POST";
 try{
  state.lastError=null;
  const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({name,version:state.bundleVersion,config:config()})});
  const data=await readApiResponse(response,"Bundle konnte nicht gespeichert werden.");
  const confirmed=persistedBundleOrThrow(data.bundle,{id:state.bundleId,previousVersion:state.bundleId?state.bundleVersion:null});
  state.bundleId=confirmed.id;state.bundleVersion=confirmed.version;
  state.data.bundles=[confirmed,...(state.data.bundles||[]).filter(x=>x.id!==confirmed.id)];
  message("Bundle gespeichert. Du kannst es jederzeit weiterbearbeiten.");renderSavedBundles();notifyChange("saved");window.dispatchEvent(new CustomEvent("cfs:builder-saved"));return data.bundle;
 }catch(error){state.lastError=readableError(error);message(state.lastError.message,"error");return null}finally{state.saving=false;if(button)button.disabled=false}
}
function manifest(){const d=selectedDesign(),s=state.data.settings||{};return{schema:"cfs-universal-bundle-v203",name:$("#ubBundleName").value.trim()||"Mein Creator Bundle",design:{key:d.key,label:d.label,accent:s.accent||d.accent,second:d.second},platforms:state.platforms,elements:state.elements.map(x=>({...x,source_url:x.source_url||(state.data.widgets||[]).find(w=>w.id===x.widget_type)?.source_url||""})),settings:s,pricing:{beta:true,label:priceLabel(state.elements.length)},exports:{obs_html:"obs/index.html",cfs_manifest:"manifest.json"},created_at:new Date().toISOString()};}
function downloadText(name,text,mime="application/json"){const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}
function crc32(bytes){let table=crc32.table;if(!table){table=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}crc32.table=table;}let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function u16(n){return[new Uint8Array([n&255,(n>>>8)&255])];}function u32(n){return[new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])];}
function zip(files){const enc=new TextEncoder(),chunks=[],central=[];let offset=0;for(const file of files){const name=enc.encode(file.name),body=typeof file.body==="string"?enc.encode(file.body):file.body,crc=crc32(body),head=new Uint8Array(30+name.length),dv=new DataView(head.buffer);dv.setUint32(0,0x04034b50,true);dv.setUint16(4,20,true);dv.setUint16(6,0,true);dv.setUint16(8,0,true);dv.setUint32(14,crc,true);dv.setUint32(18,body.length,true);dv.setUint32(22,body.length,true);dv.setUint16(26,name.length,true);head.set(name,30);chunks.push(head,body);const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0,true);cv.setUint16(10,0,true);cv.setUint32(16,crc,true);cv.setUint32(20,body.length,true);cv.setUint32(24,body.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=head.length+body.length;}const centralSize=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),ed=new DataView(end.buffer);ed.setUint32(0,0x06054b50,true);ed.setUint16(8,files.length,true);ed.setUint16(10,files.length,true);ed.setUint32(12,centralSize,true);ed.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:"application/zip"});}
async function exportBundle(){
 if(state.exporting)return;
 if(!state.elements.length||state.elements.length>24){message("Für den Export sind 1 bis 24 Elemente erlaubt.","error");if(!state.elements.length)setStep("widget");return false}
 state.exporting=true;state.lastExportError=null;const button=$("#ubExportBundle");if(button)button.disabled=true;
 try{
  const m=manifest(),model=stageModel(),v=stageStyle(model.settings,model.design),s=m.settings||{};
  const format=v.format;
  // R67: A single versioned CSS asset serves both preview and offline OBS; fail closed if missing.
  const cssResponse=await fetch("/assets/css/cfs-r67-stage.css?v=R67",{credentials:"same-origin",cache:"no-store"});
  if(!cssResponse.ok)throw Error("Gemeinsames Vorschau-Stylesheet nicht verfügbar (HTTP "+cssResponse.status+"). Kein ZIP erstellt.");
  const cssType=(cssResponse.headers.get("content-type")||"").split(";")[0].toLowerCase();
  if(!["text/css","text/plain"].includes(cssType))throw Error("Ungültiges Vorschau-Stylesheet. Kein ZIP erstellt.");
  const cssBytes=new Uint8Array(await cssResponse.arrayBuffer());
  if(cssBytes.length<100||cssBytes.length>100000)throw Error("Leeres oder zu großes Vorschau-Stylesheet. Kein ZIP erstellt.");
  const cssText=new TextDecoder().decode(cssBytes);
  if(!cssText.includes(".ub-stage.cfs-r67-stage")||!cssText.includes(".cfs-r67-offline"))throw Error("Vorschau-Stylesheet beschädigt. Kein ZIP erstellt.");
  // R73: An offline ZIP must not silently load additional/remote CSS resources.
  if(/@import\b|url\s*\(/i.test(cssText))throw Error("Vorschau-Stylesheet enthält externe oder zusätzliche Ressourcen. Kein Offline-ZIP erstellt.");
  const files=[{name:"assets/cfs-r67-stage.css",body:cssBytes}],sourcePaths=new Map();let aggregate=0;
  const sources=[...new Set(model.elements.map(x=>x.source_url).filter(Boolean))];
  if(model.elements.some(x=>x.type==="video"&&x.source_url))throw Error("Video kann nicht als statische Offline-Datei exportiert werden. Bitte stattdessen ein Bild verwenden. Kein ZIP erstellt.");
  for(const src of sources){
   try{
    const url=new URL(src,location.href);
    if(url.origin!==location.origin)throw Error("externe Bildquelle");
    const response=await fetch(url.href,{credentials:"same-origin"});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const type=(response.headers.get("content-type")||"").split(";")[0].toLowerCase();
    if(!["image/png","image/jpeg","image/webp","image/gif"].includes(type))throw Error("nicht unterstütztes Bildformat");
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(!bytes.length||bytes.length>12*1024*1024||aggregate+bytes.length>36*1024*1024)throw Error("Bild leer oder zu groß (max. 12 MB je Bild, 36 MB gesamt)");
    // MIME allein beweist kein decodierbares Bild. Ein beschädigtes Asset darf kein Erfolgs-ZIP erzeugen.
    const bitmap=await createImageBitmap(new Blob([bytes],{type})).catch(()=>{throw Error("Bild ist beschädigt oder nicht decodierbar")});
    if(!bitmap.width||!bitmap.height){bitmap.close();throw Error("Bild ohne gültige Abmessungen")}
    bitmap.close();
    aggregate+=bytes.length;
    const ext={"image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/gif":"gif"}[type];
    const path=`assets/bild-${sourcePaths.size+1}.${ext}`;files.push({name:path,body:bytes});sourcePaths.set(src,path);
   }catch(error){throw Error(`Bild ${sources.indexOf(src)+1} konnte nicht offline eingebettet werden (${error.message}). Kein ZIP erstellt. Bitte Bild ersetzen oder erneut hochladen.`)}
  }
  // Portable export: signed/private original URLs must not leak into the shared manifest.
  m.elements=m.elements.map(x=>({...x,source_url:sourcePaths.get(x.source_url)||""}));
  m.settings={channel_name:String(s.channel_name||"").slice(0,80),accent:toColor(s.accent,model.design.accent),text_color:toColor(s.text_color,"#f4f8ff"),background:toColor(s.background,model.design.surface),font_family:["Inter","system-ui","Arial","Verdana","Trebuchet MS"].includes(s.font_family)?s.font_family:"Inter",animation:["none","soft","pulse","glow","slide","pop"].includes(s.animation)?s.animation:"none",animation_speed:Math.max(.25,Math.min(3,Number(s.animation_speed)||1)),format};
  const htmlBody=stageMarkup(model,src=>sourcePaths.has(src)?`../${sourcePaths.get(src)}`:"");
  const html=`<!doctype html><html lang="de" class="cfs-r67-offline"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.name)} · statische Vorschau</title><link rel="stylesheet" href="../assets/cfs-r67-stage.css"></head><body><main class="ub-stage cfs-r67-stage cfs-r67-offline ${isR69Layout(model)?"cfs-r69-layout ":""}${format}" data-motion="${v.motion}" data-canvas="${isR69Layout(model)&&Number(model.settings.transparency)===1?"overlay":"screen"}" style="--motion-speed:${v.speed};--accent:${v.accent};--second:${v.second};--text:${v.text};--stage-font:${v.font};background:${v.background};">${htmlBody}</main></body></html>`;
  const live=state.elements.some(x=>x.platform!=="obs"||x.widget_type);
  const readme=`CFS ZOCKT · Statisches OBS/HTML-Bundle\n\nOBS: obs/index.html als lokale Browserquelle öffnen.\nWICHTIG: Dies ist eine statische Momentaufnahme ohne Live-Events.\nFür echte Follower, Chats und Goals eine authentifizierte OBS-Live-Widget-URL verwenden.\nFormat: ${format} (OBS-Browserquelle: ${format==="vertical"?"1080 x 1920":format==="square"?"1080 x 1080":"1920 x 1080"} Pixel). Enthaltene Elemente: ${state.elements.length}.\nBilddateien und das identische R67-Vorschau-Stylesheet im Unterordner assets sind lokal eingebettet und geprüft.\n\n${live?"LIVE-Widgets wurden nur mit Beispieltext exportiert, nicht mit Live-Daten.\n":""}`;
  const blob=zip([{name:"manifest.json",body:JSON.stringify(m,null,2)},{name:"README.txt",body:readme},{name:"obs/index.html",body:html},...files]);
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=(m.name.replace(/[^a-z0-9_-]+/gi,"-").toLowerCase()||"cfs-bundle")+".zip";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  message("Statisches OBS/HTML-Bundle mit gültiger ZIP-Prüfsumme exportiert. Für Live-Daten die authentifizierte Live-Widget-Quelle verwenden.","ok");
  return true;
 }catch(error){state.lastExportError=readableError(error);message(`Export fehlgeschlagen: ${state.lastExportError.message}`,"error");return false}finally{state.exporting=false;if(button)button.disabled=false}
}
// R69: Apply only reviewed, local and static template records; no second database or live scope.
function applyStaticTemplate(id,replace=false){
 if(!state.data)return false;
 const t=(window.CFSR69Templates||[]).find(item=>item.id===id&&item.version===1&&item.platform==='obs');
 if(!t||!Array.isArray(t.elements)||t.elements.length<1||t.elements.length>24)return false;
 if(state.elements.length&&!replace)return false; // Caller must obtain explicit confirmation first.
 const supported=new Map(availableStaticTemplatesTypes().map(item=>[item.key,item]));
 if(t.elements.some(item=>!supported.has(item.key)))return false;
 const design=(state.data.designs||[]).find(row=>row.key===t.design)||state.data.designs?.[0];
 if(!design)return false;
 const token=Date.now().toString(36);
 const items=t.elements.map((item,index)=>{
  const def=supported.get(item.key),type=typeFor(def);
  return {id:`r69_${t.id}_${token}_${index}`,type,platform:'obs',source_key:def.key,widget_type:'',label:def.label,
   text:String(item.text||def.label).slice(0,180),subtitle:String(item.subtitle||'').slice(0,180),
   goal:Math.max(0,Math.min(1000000000,Math.round(Number(item.goal)||0))),metric:String(item.metric||'').slice(0,80),
   enabled:true,position:{x:Number(item.position?.x)||0,y:Number(item.position?.y)||0},
   size:{width:Number(item.size?.width)||640,height:Number(item.size?.height)||120}};
 });
 state.design=design.key;state.platforms=['obs'];state.widgetPlatform='obs';
 state.elements=items;state.activeId=items[0].id;state.bundleId=null;state.bundleVersion=null;
 state.data.settings={channel_name:'',accent:toColor(t.accent,design.accent),background:toColor(t.background,design.surface),
  text_color:'#f4f8ff',font_family:'Inter',animation:t.animation||'none',animation_speed:1,
  format:['landscape','vertical','square'].includes(t.format)?t.format:'landscape',transparency:t.transparency===1?1:0};
 const name=$('#ubBundleName');if(name)name.value=String(t.name).slice(0,140);
 renderDesigns();renderPlatforms();renderWidgetPlatform();renderWidgets();renderContent();renderPreview();
 notifyChange('template');message(`Vorlage „${t.name}“ als neuer, ungespeicherter Entwurf geöffnet.`, 'ok');
 return {id:t.id,version:t.version,name:t.name,count:items.length};
}
function availableStaticTemplatesTypes(){const last=state.widgetPlatform;state.widgetPlatform='obs';try{return availableWidgets().filter(d=>d.provider==='obs');}finally{state.widgetPlatform=last;}}
// R90: A private original PNG becomes a movable/resizable static image element.
// The historical HTML scene engine is NOT imported or executed in the Builder.
function importOriginalLayers(payload,{replace=false}={}){
 if(!state.data)throw Error('Bitte anmelden und den Builder laden.');
 const catalog=payload&&Array.isArray(payload.layers)?payload.layers:[];
 const design=String(payload?.design?.id||'');const color=String(payload?.color?.id||'');
 if(!/^[a-z0-9-]{1,80}$/.test(design)||!/^[a-z0-9-]{1,40}$/.test(color))throw Error('Originaldesign oder Farbvariante ungültig.');
 const validLayers=catalog.filter(x=>x&&/^\d{2}-[A-Za-z0-9ÄÖÜäöüß-]{1,90}\.png$/.test(x.file));
 if(!validLayers.length||validLayers.length>8||validLayers.length!==catalog.length||new Set(validLayers.map(x=>x.file)).size!==validLayers.length)throw Error('Bitte 1 bis 8 unterschiedliche Original-PNGs auswählen.');
 if(state.elements.length&&!replace)throw Error('Vorhandener Entwurf muss vor dem Ersetzen bestätigt werden.');
 // Only server-verified URLs, based on an exact approved path, can be serialized.
 const elements=validLayers.map((layer,index)=>{
  const expect=`/api/creator/universal-builder/original-layer/${design}/${color}/${encodeURIComponent(layer.file)}`;
  if(layer.url!==expect)throw Error('Die originale Bildadresse wurde nicht bestätigt.');
  const width=Number(layer.width),height=Number(layer.height);
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<20||height<20||width>4096||height>4096)throw Error('Ungültige Bildabmessungen.');
  return {id:`r69_original_${index}_${Date.now().toString(36)}`,type:'image',platform:'obs',source_key:'original_design_png',widget_type:'',label:String(layer.label||layer.file).slice(0,120),text:'',subtitle:'',goal:0,metric:'',enabled:true,source_url:expect,position:{x:0,y:0},size:{width,height}};
 });
 // Vertical originals use a vertical stage; others default to the usual landscape output.
 const vertical=elements[0].size.height>elements[0].size.width*1.35;
 const key=state.data.designs.find(d=>d.key===design)?.key||state.design;
 const nextSettings={...state.data.settings,format:vertical?'vertical':'landscape',transparency:1,animation:'none',accent:toColor(payload.color.accent,state.data.settings.accent||'#20c7ff')};
 state.elements=elements;state.activeId=elements[0].id;state.design=key;state.platforms=['obs'];state.widgetPlatform='obs';state.bundleId=null;state.bundleVersion=null;state.data.settings=nextSettings;
 const input=$('#ubBundleName');if(input)input.value=`${String(payload.design?.name||design).slice(0,60)} · ${String(payload.color?.name||color).slice(0,40)}`;
 renderDesigns();renderPlatforms();renderWidgetPlatform();renderWidgets();renderContent();renderPreview();notifyChange('open');
 return {count:elements.length,name:input?.value||'Originaldesign'};
}
// R91: audited scene-mode conversion. This is a new editable approximation, NOT the legacy HTML engine.
const R91_SCENE_MODES=new Set(["start", "pause", "end", "offline", "countdown", "schedule", "credits", "gameRight", "gameLeft", "gameMinimal", "talk", "duo", "cameraFull", "portrait", "wide", "camera169", "camera43", "cameraSquare", "cameraCircle", "alertWide", "alertCompact", "alertVertical", "goal", "countdownWidget", "socials", "ticker", "labels", "sponsor", "panel"]);
function importOriginalScene(payload,{replace=false,title='GLEICH GEHT’S LOS',subtitle='Willkommen im Stream',motion='none',countdownSeconds=300,goalCurrent=25,goalTarget=100,tickerText='Willkommen im Stream'}={}){
 if(!state.data)throw Error('Bitte anmelden und Builder laden.');
 const scene=payload?.scene;
 if(!scene||!R91_SCENE_MODES.has(scene.id)||!/^\d{2}-[A-Za-z]+\.html$/.test(scene.file)||!['landscape','vertical','square'].includes(scene.format))throw Error('Szenenvorlage ungültig.');
 const listed=(payload?.scenes||[]).find(row=>row.id===scene.id);
 if(!listed||JSON.stringify(listed)!==JSON.stringify(scene))throw Error('Szenenvorlage wurde nicht vom Server bestätigt.');
 const image=payload.layers?.find(x=>x.file===scene.image);
 if(!image)throw Error('Zugehöriges Originalbild fehlt.');
 const text=String(title||'').trim().slice(0,180),sub=String(subtitle||'').trim().slice(0,180);
 if(!text||/[\u0000-\u001f]/.test(text+sub))throw Error('Text ist ungültig.');
 if(!['none','soft','pulse','glow','slide','pop'].includes(motion))throw Error('Unbekannte Bewegung.');
 // Validate specialized inputs before modifying the existing draft.
 if(['countdown','countdownWidget'].includes(scene.id)&&(!Number.isSafeInteger(Number(countdownSeconds))||Number(countdownSeconds)<0||Number(countdownSeconds)>359999))throw Error('Countdown: nur ganze Sekunden von 0 bis 359999 zulässig.');
 if(scene.id==='goal'&&(!Number.isSafeInteger(Number(goalCurrent))||!Number.isSafeInteger(Number(goalTarget))||Number(goalTarget)<1||Number(goalTarget)>1000000000||Number(goalCurrent)<0||Number(goalCurrent)>Number(goalTarget)))throw Error('Ungültige Zielwerte.');
 if(scene.id==='ticker'&&(!String(tickerText||'').trim()||String(tickerText).trim().length>180||/[\u0000-\u001f]/.test(String(tickerText))))throw Error('Ungültiger Ticker-Text.');
 const result=importOriginalLayers({...payload,layers:[image]},{replace});
 // Adapt image to output frame; do not claim source-engine dimensions are reproduced.
 const dim={landscape:[1920,1080],vertical:[1080,1920],square:[1080,1080]}[scene.format];
 const first=state.elements[0];first.size={width:dim[0],height:dim[1]};
 const textItem={id:`r69_scene_text_${Date.now().toString(36)}`,type:'text',platform:'obs',source_key:'text',widget_type:'',label:scene.name,text,subtitle:sub,goal:0,metric:'',enabled:true,position:{x:85,y:550},size:{width:Math.round(dim[0]*.72),height:Math.round(dim[1]*.25)}};
 state.elements.push(textItem);state.activeId=textItem.id;
 // R92: manual scene extras are persisted using the existing element schema;
 // no timer events, provider data, additional API, or original engine execution.
 let special=null;
 const extraBase={id:`r69_scene_special_${Date.now().toString(36)}`,platform:'obs',widget_type:'',enabled:true,position:{x:95,y:scene.format==='vertical'?970:800},size:{width:Math.round(dim[0]*.70),height:Math.round(dim[1]*.13)},goal:0,metric:'',subtitle:''};
 if(['countdown','countdownWidget'].includes(scene.id)){
  const n=Number(countdownSeconds);
  if(!Number.isSafeInteger(n)||n<0||n>359999)throw Error('Countdown: nur ganze Sekunden von 0 bis 359999 zulässig.');
  const pad=k=>String(k).padStart(2,'0');
  const time=n>=3600?`${pad(Math.floor(n/3600))}:${pad(Math.floor(n%3600/60))}:${pad(n%60)}`:`${pad(Math.floor(n/60))}:${pad(n%60)}`;
  special={...extraBase,type:'countdown',source_key:'r92_static_countdown',label:'Countdown (Momentaufnahme)',text:time,subtitle:'Countdown · statische Momentaufnahme'};
 }else if(scene.id==='goal'){
  const current=Number(goalCurrent),target=Number(goalTarget);
  if(!Number.isSafeInteger(target)||target<1||target>1000000000||!Number.isSafeInteger(current)||current<0||current>target)throw Error('Ziel: Stand und Ziel als ganze Zahlen eingeben (0 bis Ziel, Ziel maximal 1 Mrd.).');
  special={...extraBase,type:'goal',source_key:'r92_manual_goal',label:'Community-Ziel (manuell)',text:'Community-Ziel',subtitle:'Manueller Stand · nicht live',goal:target,metric:String(current)};
 }else if(scene.id==='ticker'){
  const textValue=String(tickerText||'').trim();
  if(!textValue||textValue.length>180||/[\u0000-\u001f]/.test(textValue))throw Error('Ticker-Text muss 1 bis 180 zulässige Zeichen enthalten.');
  special={...extraBase,type:'ticker',source_key:'r92_manual_ticker',label:'Ticker (manuell)',text:textValue,subtitle:'Manuelle Textmeldung · statisch'};
 }
 if(special){state.elements.push(special);state.activeId=special.id;}
 state.data.settings={...state.data.settings,format:scene.format,animation:motion,transparency:1};
 const input=$('#ubBundleName');if(input)input.value=`${String(payload.design?.name||'Design').slice(0,50)} · ${scene.name} · ${String(payload.color?.name||'Farbe').slice(0,30)}`;
 renderWidgets();renderContent();renderPreview();notifyChange('open');
 return {name:input?.value||result.name,count:state.elements.length,mode:scene.id,manual:!!special};
}
// R64: the existing, permission-checked API and editor logic stay the single source of truth.
// The four-step Universal Builder accesses them through a minimal bridge.
window.CFSUniversalBuilder = Object.freeze({
 importOriginalLayers(payload,options={}){return importOriginalLayers(payload,options);},
 importOriginalScene(payload,options={}){return importOriginalScene(payload,options);},
 template(id,options={}){return applyStaticTemplate(id,options.replace===true);},
 history(){return historyStatus();},undo(){return travelHistory(-1);},redo(){return travelHistory(1);},
 snapshot(){return {ready:!!state.data,activeId:state.activeId,designs:clone(state.data?.designs||[]),platforms:clone(state.data?.platforms||[]),registry:clone(state.data?.registry||[]),assets:clone(state.data?.assets||[]),bundles:clone(state.data?.bundles||[]),elements:clone(state.elements),selectedDesign:state.design,selectedPlatforms:[...state.platforms],settings:clone(state.data?.settings||{}),bundleId:state.bundleId,bundleVersion:state.bundleVersion};},
 theme(designKey,accent){if(!state.data)return false;const def=state.data.designs?.find(x=>x.key===designKey);if(!def)return false;state.design=designKey;state.data.settings.accent=toColor(accent,def.accent);renderDesigns();renderContent();renderPreview();notifyChange("theme");return true;},
 palette(accent){if(!state.data)return;state.data.settings.accent=toColor(accent,selectedDesign().accent);renderContent();renderPreview();notifyChange("palette");},
 platforms(keys){if(!state.data)return;const accepted=(state.data.platforms||[]).map(x=>x.key);state.platforms=[...new Set(keys.filter(x=>accepted.includes(x)))];if(!state.platforms.length)state.platforms=['obs'];state.widgetPlatform=state.platforms.find(x=>x!=='obs')||state.platforms[0];renderPlatforms();renderWidgetPlatform();renderWidgets();notifyChange("platforms");},
 add(key,platform){if(!state.data)return false;const current=state.widgetPlatform;state.widgetPlatform=platform||'obs';const defined=[...(state.data.registry||[]),...availableWidgets()].find(x=>x.key===key&&x.available!==false&&(x.provider||'obs')===state.widgetPlatform);if(!defined){state.widgetPlatform=current;return false;}const added=addWidget(key);state.widgetPlatform=current;renderWidgets();return added===true;},
 clear(){state.elements=[];state.activeId=null;state.bundleId=null;state.bundleVersion=null;renderWidgets();renderContent();renderPreview();notifyChange("clear");},
 upload(file){return uploadBuilderAsset(file,{apply:false});},
 useAsset(asset,target='active_element'){if(!state.data||!asset||!state.data.assets.some(x=>x.id===asset.id))return false;const choice=$('#ubAssetTarget');if(choice)choice.value=target;applyBuilderAsset(asset);return true;},
 async save(name){const input=$('#ubBundleName');if(input&&name)input.value=String(name).slice(0,140);const saved=await saveBundle();if(!saved)throw state.lastError||Error("Speichern fehlgeschlagen.");return saved;},
 open(id){const row=(state.data?.bundles||[]).find(x=>x.id===id);if(!row)return false;applyBundle(row);return true;},
 async refresh(){if(!state.data)return false;const response=await fetch('/api/creator/universal-builder',{credentials:'same-origin',cache:'no-store'});const data=await readApiResponse(response,'Synchronisieren fehlgeschlagen');if(!Array.isArray(data.bundles)||!Array.isArray(data.assets))throw Error('Unvollständige Serverantwort. Vorhandene Designs und Medien bleiben erhalten.');state.data.bundles=data.bundles;state.data.assets=data.assets;renderSavedBundles();renderAssetShelf();notifyChange("refresh");return true;},
 async rename(id,name){
  const row=(state.data?.bundles||[]).find(x=>x.id===id);if(!row)throw Error("Bitte Designliste aktualisieren.");
  name=String(name??"").trim();if(!name||name.length>140)throw Error("Name muss 1 bis 140 Zeichen enthalten.");
  const response=await fetch(`/api/creator/universal-builder/bundles/${encodeURIComponent(id)}/name`,{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,version:row.version})});
  const result=await readApiResponse(response,"Umbenennen fehlgeschlagen.");
  const confirmed=persistedBundleOrThrow(result.bundle,{id,previousVersion:row.version});
  state.data.bundles=state.data.bundles.map(x=>x.id===id?confirmed:x);
  if(state.bundleId===id){state.bundleVersion=confirmed.version;const input=$("#ubBundleName");if(input)input.value=confirmed.name;}
  renderSavedBundles();notifyChange("saved");return confirmed;
 },
 async duplicate(id,name){const row=(state.data?.bundles||[]).find(x=>x.id===id);if(!row)throw Error("Bitte Designliste aktualisieren.");return createCopy(row,String(name||`${row.name} (Kopie)`).slice(0,140));},
 async restoreDeleted(row){if(!row||!row.id||!Array.isArray(row.elements))throw Error("Keine Wiederherstellung verfügbar.");return createCopy(row,`${row.name} (wiederhergestellt)`.slice(0,140));},
 portable(id){const row=(state.data?.bundles||[]).find(x=>x.id===id);if(!row)throw Error("Bitte Designliste aktualisieren.");return portableDocument(row);},
  // R99: tab-only, deliberately lossy draft; excludes private assets / tokens / live URLs.
  draftScope(){return /^[a-f0-9]{32}$/.test(String(state.data?.draft_scope||""))?state.data.draft_scope:null;},
  draftDocument(name){if(!state.data||!state.elements.length)return null;
   return portableDocument({name:String(name||'Mein Streamdesign').trim().slice(0,140)||'Mein Streamdesign',...config()});
  },
 importPortable(doc,{replace=false}={}){
  if(!state.data)throw Error("Bitte erst anmelden.");const parsed=validatePortable(doc);
  if(state.elements.length&&!replace)throw Error("Für den Import erst den Austausch des aktuellen Entwurfs bestätigen.");
  state.bundleId=null;state.bundleVersion=null;state.design=parsed.config.design_key;state.platforms=clone(parsed.config.platforms);state.widgetPlatform=state.platforms[0];state.elements=clone(parsed.config.elements);state.activeId=state.elements[0]?.id||null;
  state.data.settings=clone(parsed.config.settings);const input=$("#ubBundleName");if(input)input.value=parsed.name;
  renderDesigns();renderPlatforms();renderWidgetPlatform();renderWidgets();renderContent();renderPreview();notifyChange("open");
  return {name:parsed.name,mediaOmitted:parsed.mediaOmitted};
 },
 async remove(id){const row=(state.data?.bundles||[]).find(x=>x.id===id);if(!row)return false;const response=await fetch(`/api/creator/universal-builder/bundles/${encodeURIComponent(id)}`,{method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:row.version})});const result=await readApiResponse(response,'Löschen fehlgeschlagen');if(!result.deleted)throw Error('Löschen wurde vom Server nicht bestätigt.');state.data.bundles=state.data.bundles.filter(x=>x.id!==id);if(state.bundleId===id){state.bundleId=null;state.bundleVersion=null;}renderSavedBundles();notifyChange("removed-bundle");window.dispatchEvent(new CustomEvent('cfs:builder-saved'));return true;},
 exportZip(){return exportBundle();},
 exportError(){return state.lastExportError?.message||"Export konnte nicht abgeschlossen werden.";},
 exportManifest(){return downloadText('cfs-bundle-manifest.json',JSON.stringify(manifest(),null,2));},
 settings(patch){
  if(!state.data||!patch||typeof patch!=="object")return false;
  const allowed=new Set(["channel_name","subtitle","accent","text_color","background","font_family","animation","animation_speed","format"]);
  for(const [key,value] of Object.entries(patch))if(allowed.has(key)){
   if(["accent","text_color","background"].includes(key)){if(/^#[0-9a-f]{6}$/i.test(String(value)))state.data.settings[key]=value;}
   else if(key==="animation_speed")state.data.settings[key]=Math.max(.25,Math.min(3,Number(value)||1));
   else if(key==="format"){if(["landscape","vertical","square"].includes(value))state.data.settings[key]=value;}
   else if(key==="animation"){if(["none","soft","pulse","glow","slide","pop"].includes(value))state.data.settings[key]=value;}
   else state.data.settings[key]=String(value).slice(0,key==="channel_name"?80:120);
  }
  renderContent();renderPreview();notifyChange("settings");return true;
 },
 editElement(patch){
  if(!state.data||!patch||!state.elements.length)return false;
  const item=activeElement();if(!item||item.locked===true)return false;
  for(const key of ["text","subtitle","metric"]){if(patch[key]!==undefined)item[key]=String(patch[key]).slice(0,key==="metric"?80:180);}
  if(patch.goal!==undefined)item.goal=Math.max(0,Math.min(1000000000,Math.round(Number(patch.goal)||0)));
  if(isR69Layout(stageModel())&&(patch.position||patch.size)){
   const dim={landscape:[1920,1080],vertical:[1080,1920],square:[1080,1080]}[state.data.settings.format]||[1920,1080];
   const number=(n,fallback,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(n))?Math.round(Number(n)):fallback));
   const size=patch.size||item.size||{width:640,height:120},pos=patch.position||item.position||{x:0,y:0};
   const width=number(size.width,item.size.width,20,dim[0]),height=number(size.height,item.size.height,20,dim[1]);
   item.size={width,height};item.position={x:number(pos.x,item.position.x,0,Math.floor(1000-width/dim[0]*1000)),y:number(pos.y,item.position.y,0,Math.floor(1000-height/dim[1]*1000))};
  }
  renderContent();renderPreview();notifyChange(patch.position||patch.size?"layout":"element");return true;
 },

 // R93: all editing operations mutate the same serializable element array used for save and ZIP.
 duplicateElement(id){
  if(!state.data||state.elements.length>=24)return false;
  const index=state.elements.findIndex(x=>x.id===id);
  if(index<0||state.elements[index].locked===true)return false;
  const copy=clone(state.elements[index]);
  copy.group_id='';copy.locked=false;
  const makeId=()=>`${/^r69_/.test(String(copy.id))?'r69_':''}copy_${typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`}`;
  do{copy.id=makeId()}while(state.elements.some(x=>x.id===copy.id));
  copy.label=String(copy.label||'Element').slice(0,112)+' (Kopie)';
  if(isR69Layout(stageModel())){
   const [w,h]=({landscape:[1920,1080],vertical:[1080,1920],square:[1080,1080]})[state.data.settings.format]||[1920,1080];
   const clamp=(value,max)=>Math.max(0,Math.min(max,Math.round(Number(value)||0)+20));
   copy.position={x:clamp(copy.position?.x,Math.max(0,1000-(Number(copy.size?.width)||640)/w*1000)),y:clamp(copy.position?.y,Math.max(0,1000-(Number(copy.size?.height)||120)/h*1000))};
  }
  state.elements.splice(index+1,0,copy);state.activeId=copy.id;
  renderWidgets();renderContent();renderPreview();notifyChange('duplicate');return copy.id;
 },
 moveElement(id,direction){
  if(!state.data||!['forward','backward'].includes(direction))return false;
  const index=state.elements.findIndex(x=>x.id===id),target=index+(direction==='forward'?1:-1);
  if(index<0||target<0||target>=state.elements.length||state.elements[index].locked===true)return false;
  [state.elements[index],state.elements[target]]=[state.elements[target],state.elements[index]];
  state.activeId=id;renderWidgets();renderContent();renderPreview();notifyChange('reorder');return true;
 },
 // R97: atomic, validated changes preserve one undo step and one server version.
 selectedGroup(id){const member=state.elements.find(e=>e.id===id);if(!member)return [];return member.group_id?state.elements.filter(e=>e.group_id===member.group_id).map(e=>e.id):[id];},
 groupElements(ids){
  if(!state.data||!isR69Layout(stageModel())||!Array.isArray(ids))return false;
  const unique=[...new Set(ids)],members=state.elements.filter(e=>unique.includes(e.id));
  if(unique.length<2||unique.length!==members.length||members.some(e=>e.locked))return false;
  const group='r97_'+(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID().replaceAll('-',''):Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
  for(const e of members)e.group_id=group;
  state.activeId=members.at(-1).id;renderContent();renderPreview();notifyChange('group');return group;
 },
 ungroupElements(ids){
  if(!state.data||!Array.isArray(ids))return false;
  const groups=new Set(state.elements.filter(e=>ids.includes(e.id)&&e.group_id).map(e=>e.group_id));
  const members=state.elements.filter(e=>groups.has(e.group_id));
  if(!groups.size||members.some(e=>e.locked))return false;
  for(const e of members)e.group_id='';renderContent();renderPreview();notifyChange('group');return true;
 },
 lockElements(ids,locked){
  if(!state.data||!Array.isArray(ids)||typeof locked!=='boolean')return false;
  const unique=[...new Set(ids)],members=state.elements.filter(e=>unique.includes(e.id));
  if(!unique.length||unique.length!==members.length||members.every(e=>e.locked===locked))return false;
  members.forEach(e=>e.locked=locked);renderContent();renderPreview();notifyChange('lock');return true;
 },
 moveElements(ids,dx,dy){
  if(!state.data||!isR69Layout(stageModel())||!Array.isArray(ids)||!Number.isInteger(dx)||!Number.isInteger(dy)||Math.abs(dx)>1000||Math.abs(dy)>1000)return false;
  const unique=[...new Set(ids)],members=state.elements.filter(e=>unique.includes(e.id));
  if(!unique.length||unique.length!==members.length||members.some(e=>e.locked))return false;
  const [w,h]=({landscape:[1920,1080],vertical:[1080,1920],square:[1080,1080]})[state.data.settings.format]||[1920,1080];
  const bounds=members.map(e=>({x:Number(e.position?.x)||0,y:Number(e.position?.y)||0,xMax:Math.max(0,Math.floor(1000-(Number(e.size?.width)||640)/w*1000)),yMax:Math.max(0,Math.floor(1000-(Number(e.size?.height)||120)/h*1000))}));
  const mx=Math.max(-Math.min(...bounds.map(b=>b.x)),Math.min(dx,Math.min(...bounds.map(b=>b.xMax-b.x))));
  const my=Math.max(-Math.min(...bounds.map(b=>b.y)),Math.min(dy,Math.min(...bounds.map(b=>b.yMax-b.y))));
  if(!mx&&!my)return false;
  members.forEach((e,i)=>e.position={x:bounds[i].x+mx,y:bounds[i].y+my});
  state.activeId=members[0].id;renderContent();renderPreview();notifyChange('move');return true;
 },
 nudgeElement(id,dx,dy){
  if(!state.data||!isR69Layout(stageModel())||!Number.isInteger(dx)||!Number.isInteger(dy)||Math.abs(dx)>100||Math.abs(dy)>100)return false;
  const item=state.elements.find(x=>x.id===id);if(!item||item.locked===true)return false;
  const [w,h]=({landscape:[1920,1080],vertical:[1080,1920],square:[1080,1080]})[state.data.settings.format]||[1920,1080];
  const bound=(val,delta,max)=>Math.max(0,Math.min(Math.floor(max),Math.round(Number(val)||0)+delta));
  const x=bound(item.position?.x,dx,Math.max(0,1000-(Number(item.size?.width)||640)/w*1000));
  const y=bound(item.position?.y,dy,Math.max(0,1000-(Number(item.size?.height)||120)/h*1000));
  if(x===(Number(item.position?.x)||0)&&y===(Number(item.position?.y)||0))return false;
  item.position={x,y};state.activeId=id;renderContent();renderPreview();notifyChange('move');return true;
 },
 selectElement(id){if(!state.elements.some(x=>x.id===id))return false;state.activeId=id;renderContent();notifyChange("select");return true;},
 removeElement(id){if(state.elements.find(x=>x.id===id)?.locked===true)return false;const before=state.elements.length;state.elements=state.elements.filter(x=>x.id!==id);if(before===state.elements.length)return false;state.activeId=state.elements.at(-1)?.id||null;renderWidgets();renderContent();renderPreview();notifyChange("remove");return true;},
 renderStage(){return stageMarkup();},
 renderInto(stage){return renderStageInto(stage);},
 advanced(step){setStep(step||'content');}
});
async function init(){try{const response=await fetch("/api/creator/universal-builder",{credentials:"same-origin"});const data=await readApiResponse(response,"Builder konnte nicht geladen werden.");if(!Array.isArray(data.designs)||!Array.isArray(data.platforms)||!Array.isArray(data.registry)||!Array.isArray(data.assets)||!Array.isArray(data.bundles))throw Error("Unvollständige Builder-Antwort. Bitte neu laden.");state.data=data;state.design=data.designs?.[0]?.key||"blitze";state.data.settings={channel_name:"",accent:selectedDesign().accent,text_color:"#f4f8ff",background:selectedDesign().surface,font_family:"Inter",animation:"soft",format:"landscape"};$("#ubPlan").textContent=String(data.access?.plan||"FREE").toUpperCase();$("#ubStatus").textContent="Bereit für dein erstes Bundle.";renderDesigns();renderPlatforms();renderWidgetPlatform();renderWidgets();bindContent();bindFileDock();renderContent();resetHistory();window.dispatchEvent(new CustomEvent("cfs:builder-ready"));}catch(error){const friendly=readableError(error);message(friendly.message,"error");$("#ubStatus").textContent="Nicht verfügbar";window.dispatchEvent(new CustomEvent("cfs:builder-error",{detail:{message:friendly.message}}));}}
$$('[data-step]').forEach(b=>b.onclick=()=>{if(b.dataset.step==="design"&&b.closest(".ub-steps"))setStep(b.dataset.step);else if(b.dataset.step)setStep(b.dataset.step);});$$('[data-next]').forEach(b=>b.onclick=()=>setStep(b.dataset.next));$$('[data-back]').forEach(b=>b.onclick=()=>setStep(b.dataset.back));$("#ubSaveBundle").onclick=saveBundle;$("#ubNewBundle").onclick=resetBundle;$("#ubDesignMore").onclick=()=>{state.showAllDesigns=!state.showAllDesigns;renderDesigns()};$("#ubExportBundle").onclick=exportBundle;$("#ubExportManifest").onclick=()=>downloadText("cfs-bundle-manifest.json",JSON.stringify(manifest(),null,2));$$('[data-preview-format]').forEach(b=>b.onclick=()=>{state.data.settings.format=b.dataset.previewFormat;renderPreview();notifyChange("settings");});init();
})();
