(()=>{"use strict";

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const state={scenes:[],widgets:[],scene:null,sceneOriginalName:null,config:null,selected:null,zoom:.38,dirty:false,drag:null,maxScenes:0,entitlements:{},snap:true};
const clone=v=>JSON.parse(JSON.stringify(v));
const history=window.CFSR50History.create(sceneDefaults(),60);
function syncHistoryButtons(){
  const undo=$("#sceneUndo"),redo=$("#sceneRedo"),status=$("#sceneHistoryStatus");
  if(undo)undo.disabled=!state.scene||!history.canUndo();
  if(redo)redo.disabled=!state.scene||!history.canRedo();
  if(status)status.textContent=`${history.index()+1}/${history.length()} Schritte`;
}
function resetHistory(){if(state.config)history.reset(state.config);syncHistoryButtons()}
function recordHistory(){if(!state.drag&&state.config)history.push(state.config);syncHistoryButtons()}
function restoreHistory(direction){
  if(!state.scene||state.drag)return false;
  const restored=direction==="undo"?history.undo():history.redo();
  if(!restored)return false;
  state.config=restored;
  if(!state.config.items.some(item=>item.id===state.selected))state.selected=null;
  state.dirty=true;syncSceneSaveStatus();editor();syncHistoryButtons();scheduleSceneQualityRefresh();return true;
}
function adjustSelectedScale(delta){
  const item=selectedItem();if(!item||item.locked)return false;
  const next=Math.min(5,Math.max(.1,Math.round((Number(item.scale)+delta)*100)/100));
  if(next===item.scale)return false;
  update("scale",next);return true;
}
const TRANSITIONS=new Set(["cut","fade","dissolve","slide_left","slide_right","slide_up","zoom"]);
const EASINGS=new Set(["smooth","ease","ease_in_out","linear"]);

function toast(msg,bad=false){
  const e=$("#sceneToast");e.textContent=msg;e.style.borderColor=bad?"#713441":"#1d5d86";e.hidden=false;
  clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,2500);
}
function profile(){return state.config?.profile==="landscape"?{key:"landscape",width:1920,height:1080}:{key:"tiktok_vertical",width:1080,height:1920}}
function widgetById(id){return state.widgets.find(w=>String(w.id)===String(id))}
function selectedItem(){return state.config?.items?.find(i=>i.id===state.selected)||null}
function sceneItemSize(item){
  const w=widgetById(item.widget_id),scale=Math.max(.1,Math.min(5,Number(item.scale)||1));
  return {width:Math.max(1,Number(w?.canvas?.width)||600)*scale,height:Math.max(1,Number(w?.canvas?.height)||120)*scale};
}
function snapCoordinate(value,positions,tolerance=12){
  const candidate=positions.filter(Number.isFinite).map(p=>({point:Math.round(p),distance:Math.abs(p-value)})).sort((a,b)=>a.distance-b.distance)[0];
  return candidate&&candidate.distance<=tolerance?candidate.point:Math.round(value);
}
function snappedScenePosition(item,x,y){
  if(!state.snap)return{x:Math.round(x),y:Math.round(y)};
  const p=profile(),box=sceneItemSize(item),safeX=p.key==="tiktok_vertical"?70:60,safeY=p.key==="tiktok_vertical"?120:54;
  return {
    x:snapCoordinate(x,[0,safeX,(p.width-box.width)/2,p.width-box.width-safeX,p.width-box.width]),
    y:snapCoordinate(y,[0,safeY,(p.height-box.height)/2,p.height-box.height-safeY,p.height-box.height])
  };
}
function positionItem(item,x,y){
  if(!item||item.locked)return false;
  const nx=Math.round(Math.max(-4000,Math.min(4000,x))),ny=Math.round(Math.max(-4000,Math.min(4000,y)));
  if(nx===item.x&&ny===item.y)return false;
  item.x=nx;item.y=ny;dirty();return true;
}
function centerItem(axis){
  const item=selectedItem();if(!item||item.locked)return false;
  const p=profile(),box=sceneItemSize(item),nextX=axis==="x"?Math.round((p.width-box.width)/2):item.x,nextY=axis==="y"?Math.round((p.height-box.height)/2):item.y;
  const changed=positionItem(item,nextX,nextY);if(changed){renderItems();props()}return changed;
}
function fitSelectedToSafeArea(){
 const item=selectedItem();if(!item||item.locked)return false;
 const widget=widgetById(item.widget_id),p=profile();if(!widget)return false;
 const vertical=p.key==='tiktok_vertical',mx=vertical?70:60,my=vertical?120:54;
 const geometry=window.CFSR54SafeLayout;if(!geometry)return false;
 const next=geometry.fitScene(item,widget.canvas,p,{left:mx,right:mx,top:my,bottom:my});
 if(!next){toast('Dieses Widget ist selbst bei kleinster Größe zu groß für den Sicherheitsbereich.',true);return false;}
 if(item.x===next.x&&item.y===next.y&&Math.abs(item.scale-next.scale)<.00001){toast('Widget liegt bereits im Sicherheitsbereich.');return false;}
 Object.assign(item,next);dirty();renderItems();props();toast('Widget vollständig in den Sicherheitsbereich eingepasst.');return true;
}
function changeLayer(direction){
  const item=selectedItem(),items=state.config?.items||[];if(!item||item.locked)return false;
  const ordered=[...items].sort((a,b)=>(a.z_index||0)-(b.z_index||0)||items.indexOf(a)-items.indexOf(b));
  const index=ordered.indexOf(item),dest=index+direction;if(index<0||dest<0||dest>=ordered.length)return false;
  [ordered[index],ordered[dest]]=[ordered[dest],ordered[index]];
  ordered.forEach((entry,i)=>{entry.z_index=i});dirty();renderItems();props();return true;
}
function nudgeSelected(key,amount){
  const item=selectedItem();if(!item||item.locked)return false;
  const x=item.x+(key==="ArrowLeft"?-amount:key==="ArrowRight"?amount:0),y=item.y+(key==="ArrowUp"?-amount:key==="ArrowDown"?amount:0);
  const changed=positionItem(item,x,y);if(changed){renderItems();props()}return changed;
}
function transitionDefaults(){return{type:"cut",duration_ms:0,easing:"smooth"}}
function normalizeTransition(input={}){
  const source=input&&typeof input==="object"?input:{},type=TRANSITIONS.has(String(source.type||""))?String(source.type):"cut",easing=EASINGS.has(String(source.easing||""))?String(source.easing):"smooth";
  const raw=Number(source.duration_ms??source.durationMs),duration_ms=type==="cut"?0:Math.round(Math.max(120,Math.min(2500,Number.isFinite(raw)?raw:450)));
  return{type,duration_ms,easing};
}
function transitionLabel(input={}){
  return {cut:"Schnitt",fade:"Fade",dissolve:"Dissolve",slide_left:"Slide rechts",slide_right:"Slide links",slide_up:"Slide hoch",zoom:"Zoom"}[normalizeTransition(input).type]||"Schnitt";
}
function easingCss(key){
  return {smooth:"cubic-bezier(.16,1,.3,1)",ease:"ease",ease_in_out:"ease-in-out",linear:"linear"}[key]||"cubic-bezier(.16,1,.3,1)";
}
function transitionFrames(type,direction="in"){
  const incoming=direction==="in";
  if(type==="fade")return incoming?[{opacity:0},{opacity:1}]:[{opacity:1},{opacity:0}];
  if(type==="dissolve")return incoming?[{opacity:0,filter:"blur(14px)"},{opacity:1,filter:"blur(0px)"}]:[{opacity:1,filter:"blur(0px)"},{opacity:0,filter:"blur(10px)"}];
  if(type==="slide_left")return incoming?[{opacity:.2,transform:"translateX(9%)"},{opacity:1,transform:"translateX(0)"}]:[{opacity:1,transform:"translateX(0)"},{opacity:0,transform:"translateX(-6%)"}];
  if(type==="slide_right")return incoming?[{opacity:.2,transform:"translateX(-9%)"},{opacity:1,transform:"translateX(0)"}]:[{opacity:1,transform:"translateX(0)"},{opacity:0,transform:"translateX(6%)"}];
  if(type==="slide_up")return incoming?[{opacity:.2,transform:"translateY(8%)"},{opacity:1,transform:"translateY(0)"}]:[{opacity:1,transform:"translateY(0)"},{opacity:0,transform:"translateY(-5%)"}];
  if(type==="zoom")return incoming?[{opacity:0,transform:"scale(1.055)"},{opacity:1,transform:"scale(1)"}]:[{opacity:1,transform:"scale(1)"},{opacity:0,transform:"scale(.975)"}];
  return null;
}
function previewTransition(node,transition=state.config?.transition){
  if(!node)return;
  const t=normalizeTransition(transition);
  if(t.type==="cut"){toast("Schnitt hat keine Animationsdauer.");return}
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches){toast("Transitions-Vorschau ist wegen reduzierter Bewegung deaktiviert.");return}
  const frames=transitionFrames(t.type,"in");
  if(!frames||typeof node.animate!=="function"){toast("Übergang kann in diesem Browser nicht animiert werden.",true);return}
  node.getAnimations?.().forEach(animation=>animation.cancel());
  node.animate(frames,{duration:t.duration_ms,easing:easingCss(t.easing),fill:"both"});
}
function sceneDefaults(key="tiktok_vertical"){
  const l=key==="landscape";
  return{version:1,profile:l?"landscape":"tiktok_vertical",canvas:{width:l?1920:1080,height:l?1080:1920,background:"transparent",safe_area:true},transition:transitionDefaults(),items:[]};
}
function defaultItem(widget,index){
  const p=profile(),cw=Number(widget.canvas?.width||600);
  return{id:`item_${Date.now()}_${index}`,widget_id:String(widget.id),visible:true,x:Math.round(p.width/2-cw/2),y:Math.round(p.height*.22+index*45),scale:1,opacity:1,rotation:0,z_index:index,locked:false};
}
let qualityRefreshTimer=null,qualityBaseline=null,qualityBaselineSceneId=null;
function scheduleSceneQualityRefresh(){
 clearTimeout(qualityRefreshTimer);
 qualityRefreshTimer=setTimeout(()=>{if(!state.drag&&state.scene&&state.config)sceneQualityReport();},180);
}
function syncSceneSaveStatus(){
  const indicator=$("#sceneUnsavedStatus");
  if(!indicator)return;
  indicator.hidden=!state.dirty;
  indicator.textContent=state.dirty?"Änderungen nicht gespeichert":"";
}
function confirmDiscardSceneChanges(){
  return !state.dirty||window.confirm("Diese Scene hat ungespeicherte Änderungen. Änderungen verwerfen und fortfahren?")===true;
}
function warnBeforeSceneUnload(event){
  if(!state.dirty)return;
  event.preventDefault();
  event.returnValue="";
}
function dirty(){state.dirty=true;syncSceneSaveStatus();recordHistory();scheduleSceneQualityRefresh()}
function fit(){
  if(!state.config)return;
  const p=profile(),maxW=Math.min(900,Math.max(320,innerWidth-560)),fitScale=Math.min(maxW/p.width,610/p.height),scale=Math.max(.12,Math.min(1.25,state.zoom||fitScale));
  state.config.canvas.width=p.width;state.config.canvas.height=p.height;
  const v=$("#sceneViewport"),c=$("#sceneCanvas");
  v.style.width=Math.round(p.width*scale)+"px";v.style.height=Math.round(p.height*scale)+"px";
  c.style.width=p.width+"px";c.style.height=p.height+"px";c.style.transform=`scale(${scale})`;c.style.background=state.config.canvas.background||"transparent";
  const g=$("#sceneSafeGuide"),vertical=p.key==="tiktok_vertical",mx=vertical?70:60,my=vertical?120:54;
  g.hidden=state.config.canvas.safe_area===false;g.style.left=mx+"px";g.style.top=my+"px";g.style.right=mx+"px";g.style.bottom=my+"px";
  $("#sceneZoom").textContent=Math.round(scale*100)+"%";
}
function renderScenes(){
  $("#sceneCount").textContent=state.scenes.length;
  $("#sceneList").innerHTML=state.scenes.length?state.scenes.map(s=>{
    const transition=s.draft_config?.transition||s.published_config?.transition||transitionDefaults();
    return `<div class="scene-list-item ${state.scene?.id===s.id?"active":""}" data-scene="${CFS.escape(s.id)}"><strong>${CFS.escape(s.name)}</strong><small>${s.profile==="landscape"?"16:9 · 1920×1080":"TikTok · 1080×1920"} · ${CFS.escape(transitionLabel(transition))}</small><span class="scene-mini-status ${s.status==="live"?"live":""}">${s.status==="live"?"LIVE":"DRAFT"}</span></div>`;
  }).join(""):'<div class="scene-hint">Noch keine Scenes.</div>';
}
function renderLibrary(){
  $("#widgetCount").textContent=state.widgets.length;
  $("#widgetLibrary").innerHTML=state.widgets.length?state.widgets.map(w=>`<div class="widget-library-item" data-add-widget="${CFS.escape(w.id)}"><strong>${CFS.escape(w.name)}</strong><small>${CFS.escape(w.widget_type)} · ${Number(w.canvas?.width||600)}×${Number(w.canvas?.height||120)}</small></div>`).join(""):'<div class="scene-hint">Veröffentliche zuerst ein Widget.</div>';
}
function renderSceneLayers(){
  const host=$("#sceneLayerList"),panel=$("#sceneLayerPanel");
  if(!host||!panel)return;
  panel.hidden=!state.scene;
  if(!state.scene)return;
  const helper=window.CFSR55SceneLayers;
  if(!helper)return;
  const all=helper.ordered(state.config?.items||[]);
  const search=$("#sceneLayerSearch")?.value||"";
  const shown=all.filter(item=>helper.matches(item,widgetById(item.widget_id),search));
  const count=$("#sceneLayerCount");if(count)count.textContent=shown.length===all.length?String(all.length):`${shown.length}/${all.length}`;
  host.innerHTML=shown.length?shown.map(item=>{
    const widget=widgetById(item.widget_id),title=widget?.name||"Nicht mehr verfügbares Widget";
    const active=item.id===state.selected,shown=item.visible!==false,locked=item.locked===true;
    const up=helper.canMove(state.config.items,item.id,1),down=helper.canMove(state.config.items,item.id,-1);
    const id=CFS.escape(String(item.id)),name=CFS.escape(String(title));
    return `<div class="cfs-r55-row ${active?'is-selected':''} ${shown?'':'is-hidden'}" data-r55-row="${id}">
      <button class="cfs-r55-select" type="button" data-r55-select="${id}" aria-current="${active?'true':'false'}" title="${name} auswählen"><span class="cfs-r55-dot" aria-hidden="true"></span><span class="cfs-r55-name">${name}</span><small>${Math.round((Number(item.scale)||1)*100)} %</small></button>
      <div class="cfs-r55-actions">
        <button type="button" data-r55-visible="${id}" aria-label="${shown?'Ausblenden':'Einblenden'}: ${name}" aria-pressed="${shown}">${shown?'◉':'○'}</button>
        <button type="button" data-r55-lock="${id}" aria-label="${locked?'Entsperren':'Sperren'}: ${name}" aria-pressed="${locked}">${locked?'▣':'◇'}</button>
        <button type="button" data-r55-up="${id}" aria-label="Eine Ebene nach vorne: ${name}" ${up?'':'disabled'}>↑</button>
        <button type="button" data-r55-down="${id}" aria-label="Eine Ebene nach hinten: ${name}" ${down?'':'disabled'}>↓</button>
      </div>
    </div>`;
  }).join(""):`<p class="cfs-r55-empty">${all.length?'Keine passenden Ebenen.':'Noch keine Widgets in dieser Scene.'}</p>`;
}
function sceneLayerAction(event){
  const button=event.target.closest?.('button[data-r55-select],button[data-r55-visible],button[data-r55-lock],button[data-r55-up],button[data-r55-down]');
  if(!button||!state.config||!state.scene)return;
  const entry=Object.entries(button.dataset).find(([key])=>['r55Select','r55Visible','r55Lock','r55Up','r55Down'].includes(key));
  if(!entry)return;
  const item=state.config.items.find(value=>String(value.id)===entry[1]);
  if(!item)return;
  if(entry[0]==='r55Select'){
    state.selected=item.id;renderItems();props();return;
  }
  if(entry[0]==='r55Visible')item.visible=item.visible===false;
  else if(entry[0]==='r55Lock')item.locked=!item.locked;
  else{
    const dir=entry[0]==='r55Up'?1:-1,helper=window.CFSR55SceneLayers;
    if(!helper?.canMove(state.config.items,item.id,dir))return;
    state.selected=item.id;
    changeLayer(dir);return;
  }
  dirty();renderItems();props();
}
function renderItems(){
  renderSceneLayers();
  if(!state.config)return;
  $("#sceneItems").innerHTML=[...(state.config.items||[])].sort((a,b)=>(a.z_index||0)-(b.z_index||0)).map(item=>{
    const w=widgetById(item.widget_id),url=w?.source_urls?.obs||w?.source_url;if(!w||!url)return"";
    const width=Number(w.canvas?.width||600),height=Number(w.canvas?.height||120);
    return`<div class="scene-item ${item.id===state.selected?"selected":""}" data-item="${CFS.escape(item.id)}" aria-locked="${item.locked===true}" style="left:${item.x}px;top:${item.y}px;opacity:${item.visible===false?0:item.opacity};z-index:${item.z_index};transform:rotate(${item.rotation||0}deg) scale(${item.scale||1})"><iframe src="${CFS.escape(url)}" width="${width}" height="${height}" scrolling="no"></iframe></div>`;
  }).join("");
}
function props(){
  const i=selectedItem(),p=$("#sceneProperties");p.hidden=!i;if(!i)return;
  const w=widgetById(i.widget_id);$("#selectedItemName").textContent=w?.name||"Widget";
  $("#itemX").value=i.x;$("#itemY").value=i.y;$("#itemScale").value=i.scale;$("#itemRotation").value=i.rotation||0;$("#itemOpacity").value=i.opacity;$("#itemZ").value=i.z_index;
  const pct=Math.round(Math.max(0,Math.min(1,Number.isFinite(Number(i.opacity))?Number(i.opacity):1))*100);
  const r53Range=$("#sceneOpacityRange"),r53Output=$("#sceneOpacityPercent");
  if(r53Range)r53Range.value=String(pct);
  if(r53Output)r53Output.textContent=pct+" %";
  $("#toggleItemVisible").textContent=i.visible===false?"EINBLENDEN":"AUSBLENDEN";
  $("#sceneItemLock").textContent=i.locked?"Position entsperren":"Position sperren";
  $("#sceneItemLock").setAttribute("aria-pressed",String(i.locked===true));
  for(const id of ["sceneCenterX","sceneCenterY","sceneLayerBack","sceneLayerFront","sceneScaleDown","sceneScaleUp","sceneSafeFit"]){const control=$("#"+id);if(control)control.disabled=i.locked===true;}
  for(const id of ["itemX","itemY","itemScale","itemRotation","itemZ"]){$("#"+id).disabled=i.locked===true;}
  const safeReadout=$("#sceneSafeFitSize"),widget=widgetById(i.widget_id);
  if(safeReadout&&widget&&window.CFSR54SafeLayout){const b=window.CFSR54SafeLayout.sceneBounds(i.x,i.y,Number(widget.canvas?.width)||600,Number(widget.canvas?.height)||120,i.scale,i.rotation||0);safeReadout.textContent=b?`Sichtbarer Rahmen: ${Math.round(b.w)} × ${Math.round(b.h)} px`:'Größe nicht verfügbar';}
  const scaleText=$("#sceneScaleValue");if(scaleText)scaleText.textContent=`${Math.round((Number(i.scale)||1)*100)} %`;
}
function syncTransitionControls(){
  if(!state.config)return;
  state.config.transition=normalizeTransition(state.config.transition);
  const t=state.config.transition,type=$("#sceneTransition"),duration=$("#sceneTransitionDuration"),durationValue=$("#sceneTransitionDurationValue"),ease=$("#sceneTransitionEase"),preview=$("#previewSceneTransition");
  if(type)type.value=t.type;
  if(duration){duration.value=String(t.type==="cut"?450:t.duration_ms||450);duration.disabled=t.type==="cut";}
  if(durationValue)durationValue.textContent=t.type==="cut"?"0 ms":`${t.duration_ms} ms`;
  if(ease){ease.value=t.easing;ease.disabled=t.type==="cut";}
  if(preview)preview.disabled=t.type==="cut";
}
function editor(){
  const active=!!state.scene;$("#sceneEmpty").hidden=active;$("#sceneEditor").hidden=!active;renderSceneLayers();if(!active)return;
  state.config.transition=normalizeTransition(state.config.transition);
  $("#sceneName").value=state.scene.name;$("#sceneStatus").textContent=state.scene.status==="live"?"LIVE":"DRAFT";$("#sceneStatus").className="scene-status"+(state.scene.status==="live"?" live":"");
  $("#sceneProfile").value=state.config.profile;$("#sceneBackground").value=state.config.canvas.background||"transparent";$("#sceneSafeArea").checked=state.config.canvas.safe_area!==false;$("#sceneSnap").checked=state.snap;
  syncTransitionControls();
  const url=state.scene.status==="live"?state.scene.source_url||"":"";
  $("#sceneOutputUrl").value=url;$("#openSceneUrl").href=url||"#";$("#openSceneUrl").style.pointerEvents=url?"auto":"none";$("#copySceneUrl").disabled=!url;
  fit();renderItems();props();syncHistoryButtons();sceneQualityReport();
}
function selectSceneAuditElement(id){
 const item=state.config?.items?.find(entry=>String(entry.id)===String(id));
 if(!item)return false;
 state.selected=item.id;renderItems();props();
 document.getElementById('sceneProperties')?.scrollIntoView({block:'nearest',behavior:'smooth'});
 return true;
}
function recenterSceneAuditElement(id){
 const item=state.config?.items?.find(entry=>String(entry.id)===String(id));
 if(!item||item.locked){toast('Element ist gesperrt oder nicht mehr vorhanden.',true);return false;}
 const widget=widgetById(item.widget_id),w=Number(widget?.canvas?.width),h=Number(widget?.canvas?.height),scale=Number(item.scale),rotation=Number(item.rotation)||0;
 const x=Number(item.x),y=Number(item.y),canvas=state.config.canvas;
 if(![w,h,scale,rotation,x,y].every(Number.isFinite)||w<=0||h<=0||scale<=0)return false;
 const checker=window.CFSR41OutputAudit,rect=window.CFSR54SafeLayout?.sceneBounds(x,y,w,h,scale,rotation)||checker.bounds(x,y,w*scale,h*scale,rotation);
 const targetX=Math.round(x+Number(canvas.width)/2-(rect.x+rect.w/2));
 const targetY=Math.round(y+Number(canvas.height)/2-(rect.y+rect.h/2));
 if(!positionItem(item,targetX,targetY)){selectSceneAuditElement(id);return false;}
 state.selected=item.id;renderItems();props();sceneQualityReport({openPanel:true});
 toast('Element ins Bild gesetzt – bitte prüfen und speichern.');
 return true;
}
function sceneQualityReport({openPanel=false}={}){
  const checker=window.CFSR41OutputAudit;if(!checker||!state.config)return null;
  const result=checker.analyzeScene(state.config,state.widgets),node=$("#sceneQualityResult"),badge=$("#sceneQualityCompact");
  const currentSceneId=String(state.scene?.id||'');
  if(qualityBaselineSceneId!==currentSceneId){qualityBaseline=null;qualityBaselineSceneId=currentSceneId;}
  if(!qualityBaseline)qualityBaseline=result;
  checker.populate(node,result,{onSelect:selectSceneAuditElement,onFix:recenterSceneAuditElement,canFix:id=>{const item=state.config?.items?.find(i=>String(i.id)===String(id));return !!item&&!item.locked;},baseline:qualityBaseline,onResetBaseline:()=>{qualityBaseline=checker.analyzeScene(state.config,state.widgets);sceneQualityReport({openPanel:true});}});if(badge)badge.textContent=result.summary;
  if(openPanel){const panel=$("#sceneQualityPanel");if(panel)panel.open=true;}
  return result;
}
function downloadSceneQuality(){
 if(!state.scene||!state.config){toast('Bitte zuerst eine Scene öffnen.',true);return;}
 const check=sceneQualityReport({openPanel:true}),exporter=window.CFSR45QualityReport;
 if(!check||!exporter){toast('Prüfbericht momentan nicht verfügbar.',true);return;}
 try{exporter.download(check,'scene',$('#sceneName')?.value||state.scene?.name||'scene');toast('Scene-Prüfbericht als JSON heruntergeladen.');}
 catch(error){toast(error.message||'Prüfbericht konnte nicht exportiert werden.',true);}
}
function render(){renderScenes();renderLibrary();editor();syncSceneSaveStatus()}
async function load(){
  const d=await CFS.json("/api/creator/widget-studio/scenes");
  state.scenes=d.scenes||[];state.widgets=d.widgets||[];state.maxScenes=Number(d.limits?.max_scenes||0);state.entitlements=d.entitlements||{};
  if(state.scene){
    const f=state.scenes.find(s=>s.id===state.scene.id);
    if(f){state.scene=f;state.config=clone(f.draft_config||sceneDefaults(f.profile));state.config.transition=normalizeTransition(state.config.transition)}
  }
  state.sceneOriginalName=state.scene?state.scene.name:null;
  state.dirty=false;resetHistory();render();
}
async function create(key){
  if(!confirmDiscardSceneChanges())return;
  if(state.maxScenes&&state.scenes.length>=state.maxScenes){toast(`Dein Zugriff erlaubt maximal ${state.maxScenes} Scenes.`,true);return}
  const d=await CFS.json("/api/creator/widget-studio/scenes",{method:"POST",body:JSON.stringify({name:key==="landscape"?"Neue 16:9 Scene":"Neue TikTok Scene",profile:key,config:sceneDefaults(key)})});
  state.scene=d.scene;state.config=clone(d.scene.draft_config);state.config.transition=normalizeTransition(state.config.transition);state.selected=null;await load();toast("Scene erstellt.");
}
function open(id){
  const s=state.scenes.find(x=>String(x.id)===String(id));if(!s||String(state.scene?.id)===String(id))return;
  if(!confirmDiscardSceneChanges())return;
  // The name field edits the cached scene for immediate sidebar feedback.
  // Restore its last persisted name when a confirmed switch discards those edits.
  if(state.dirty&&state.scene&&state.sceneOriginalName!==null)state.scene.name=state.sceneOriginalName;
  state.scene=s;state.sceneOriginalName=s.name;state.config=clone(s.draft_config||sceneDefaults(s.profile));state.config.transition=normalizeTransition(state.config.transition);state.selected=null;state.dirty=false;resetHistory();
  const p=profile();state.zoom=Math.min(Math.min(900,Math.max(320,innerWidth-560))/p.width,610/p.height);render();
}
async function save(){
  const d=await CFS.json(`/api/creator/widget-studio/scenes/${encodeURIComponent(state.scene.id)}`,{method:"PUT",body:JSON.stringify({name:$("#sceneName").value,config:state.config,expected_version:state.scene.version})});
  state.scene=d.scene;state.config=clone(d.scene.draft_config);state.config.transition=normalizeTransition(state.config.transition);state.dirty=false;syncSceneSaveStatus();await load();toast("Scene gespeichert.");
}
async function publish(){
  const quality=sceneQualityReport();
  if(quality&&quality.errors.length){sceneQualityReport({openPanel:true});throw new Error(`Scene noch nicht bereit: ${quality.errors.length} Fehler im Qualitätscheck.`);}
  if(state.dirty)await save();
  const d=await CFS.json(`/api/creator/widget-studio/scenes/${encodeURIComponent(state.scene.id)}/publish`,{method:"POST",body:JSON.stringify({expected_version:state.scene.version})});
  state.scene=d.scene;await load();toast("Scene veröffentlicht.");
}
function addWidget(id){
  const w=widgetById(id);if(!w||!state.config)return;
  if(state.config.items.length>=24){toast("Maximal 24 Widgets pro Scene.",true);return}
  const i=defaultItem(w,state.config.items.length);state.config.items.push(i);state.selected=i.id;dirty();editor();
}
function update(field,value){const i=selectedItem();if(!i)return;
  if(i.locked&&["x","y","scale","rotation","z_index"].includes(field)){toast("Position ist gesperrt.",true);props();return;}
  if(i[field]===value)return;
  i[field]=value;dirty();renderItems();props();}
function dragStart(e,id){
  if(e.button!==undefined&&e.button!==0)return;
  const i=state.config?.items?.find(x=>x.id===id);if(!i)return;
  state.selected=id;renderItems();props();
  if(i.locked)return;
  const z=parseFloat($("#sceneZoom").textContent)/100||state.zoom||.4;
  state.drag={item:i,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:i.x,y:i.y,zoom:z};
  $(".scene-stage-wrap").classList.add("dragging");
  if(e.pointerId!=null)try{$("#sceneItems").setPointerCapture(e.pointerId)}catch(_error){}
  e.preventDefault();
}
function dragMove(e){
  const d=state.drag;if(!d||(d.pointerId!=null&&e.pointerId!==d.pointerId))return;
  const x=d.x+(e.clientX-d.startX)/d.zoom,y=d.y+(e.clientY-d.startY)/d.zoom;
  const point=snappedScenePosition(d.item,x,y);
  if(positionItem(d.item,point.x,point.y)){
    // Avoid rebuilding embedded OBS iframes during every pointer movement.
    const el=[...$("#sceneItems").children].find(node=>node.dataset.item===d.item.id);
    if(el){el.style.left=d.item.x+"px";el.style.top=d.item.y+"px";}
  }
  e.preventDefault();
}
function dragEnd(e){
  if(!state.drag||(e?.pointerId!=null&&state.drag.pointerId!=null&&e.pointerId!==state.drag.pointerId))return;
  const id=state.drag.pointerId;state.drag=null;$(".scene-stage-wrap").classList.remove("dragging");
  if(id!=null)try{if($("#sceneItems").hasPointerCapture(id))$("#sceneItems").releasePointerCapture(id)}catch(_error){}
  recordHistory();props();sceneQualityReport();
}
function handleSceneKeys(e){
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&["z","y"].includes(e.key.toLowerCase())){
    const field=e.target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName||"");
    if(!field&&state.scene){e.preventDefault();restoreHistory(e.key.toLowerCase()==="y"||e.shiftKey?"redo":"undo");}
    return;
  }
  if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)||e.ctrlKey||e.metaKey||!state.scene||!selectedItem())return;
  const target=e.target;
  if(target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target?.tagName||"")||target?.closest?.('[role="dialog"], [contenteditable="true"]'))return;
  if(selectedItem().locked)return;
  e.preventDefault();nudgeSelected(e.key,e.shiftKey?10:1);
}
function updateTransition(patch={}){
  if(!state.config)return;
  const previous=normalizeTransition(state.config.transition),next=normalizeTransition({...previous,...patch});
  state.config.transition=next;dirty();syncTransitionControls();renderScenes();
}
function bind(){
  $("#mobileNavToggle").onclick=()=>$("#mainNav").classList.toggle("open");
  $("#newVerticalScene").onclick=()=>create("tiktok_vertical").catch(e=>toast(e.message,true));
  $("#newLandscapeScene").onclick=()=>create("landscape").catch(e=>toast(e.message,true));
  $("#refreshScenes").onclick=()=>{if(confirmDiscardSceneChanges())load().catch(e=>toast(e.message,true))};
  $("#sceneList").onclick=e=>{const x=e.target.closest("[data-scene]");if(x)open(x.dataset.scene)};
  $("#widgetLibrary").onclick=e=>{const x=e.target.closest("[data-add-widget]");if(x)addWidget(x.dataset.addWidget)};
  $("#sceneLayerList").addEventListener("click",sceneLayerAction);
  $("#sceneLayerSearch").addEventListener("input",renderSceneLayers);
  $("#saveScene").onclick=()=>save().catch(e=>toast(e.message,true));
  $("#publishScene").onclick=()=>publish().catch(e=>toast(e.message,true));
  $("#sceneQualityRun").onclick=()=>sceneQualityReport({openPanel:true});
  $("#sceneQualityDownload").onclick=downloadSceneQuality;
  $("#sceneName").oninput=()=>{state.scene.name=$("#sceneName").value;dirty();renderScenes()};
  $("#sceneProfile").onchange=e=>{
    const transition=normalizeTransition(state.config?.transition);
    state.config=sceneDefaults(e.target.value);state.config.transition=transition;state.selected=null;dirty();editor();toast("Format geändert. Widgets bitte neu platzieren.");
  };
  $("#sceneBackground").onchange=e=>{state.config.canvas.background=e.target.value||"transparent";dirty();editor()};
  $("#sceneSafeArea").onchange=e=>{state.config.canvas.safe_area=!!e.target.checked;dirty();editor()};
  $("#sceneSnap").onchange=e=>{state.snap=!!e.target.checked};
  $("#sceneUndo").onclick=()=>restoreHistory("undo");
  $("#sceneRedo").onclick=()=>restoreHistory("redo");
  $("#sceneScaleDown").onclick=()=>adjustSelectedScale(-.05);
  $("#sceneScaleUp").onclick=()=>adjustSelectedScale(.05);
  $("#sceneCenterX").onclick=()=>centerItem("x");
  $("#sceneCenterY").onclick=()=>centerItem("y");
  $("#sceneSafeFit").onclick=fitSelectedToSafeArea;
  $("#sceneLayerBack").onclick=()=>changeLayer(-1);
  $("#sceneLayerFront").onclick=()=>changeLayer(1);
  $("#sceneItemLock").onclick=()=>{const i=selectedItem();if(!i)return;i.locked=!i.locked;dirty();renderItems();props()};
  document.addEventListener("keydown",handleSceneKeys);
  $("#sceneTransition").onchange=e=>updateTransition({type:e.target.value,duration_ms:e.target.value==="cut"?0:Math.max(120,Number($("#sceneTransitionDuration").value)||450)});
  $("#sceneTransitionDuration").oninput=e=>updateTransition({duration_ms:Number(e.target.value)||450});
  $("#sceneTransitionEase").onchange=e=>updateTransition({easing:e.target.value});
  $("#previewSceneTransition").onclick=()=>previewTransition($("#sceneViewport"));
  $$("[data-zoom]").forEach(b=>b.onclick=()=>{state.zoom=Math.max(.12,Math.min(1.25,state.zoom+(b.dataset.zoom==="+"?.05:-.05)));fit()});
  $("#sceneItems").addEventListener("pointerdown",e=>{const x=e.target.closest("[data-item]");if(x)dragStart(e,x.dataset.item)});
  $("#sceneItems").addEventListener("pointermove",dragMove);
  $("#sceneItems").addEventListener("pointerup",dragEnd);
  $("#sceneItems").addEventListener("pointercancel",dragEnd);
  addEventListener("pointerup",dragEnd);addEventListener("blur",()=>dragEnd());
  $("#itemX").onchange=e=>update("x",Math.round(Number(e.target.value)||0));
  $("#itemY").onchange=e=>update("y",Math.round(Number(e.target.value)||0));
  $("#itemScale").onchange=e=>update("scale",Math.max(.1,Math.min(5,Number(e.target.value)||1)));
  $("#itemRotation").onchange=e=>update("rotation",Math.max(-360,Math.min(360,Number(e.target.value)||0)));
  $("#itemOpacity").onchange=e=>update("opacity",Math.max(0,Math.min(1,Number(e.target.value))));
  const opacitySlider=$("#sceneOpacityRange"),R53=window.CFSR53DesignProperties;
  opacitySlider.oninput=()=>{const item=selectedItem();if(!item)return;const pct=R53.percent(R53.opacity(opacitySlider.value));$("#sceneOpacityPercent").textContent=pct+" %";const el=[...document.querySelectorAll("#sceneItems .scene-item")].find(node=>node.dataset.item===item.id);if(el)el.style.opacity=item.visible===false?"0":String(R53.opacity(pct));};
  opacitySlider.onchange=()=>{const item=selectedItem();if(!item)return;update("opacity",R53.opacity(opacitySlider.value));};
  $("#sceneOpacityReset").onclick=()=>update("opacity",1);
  $("#itemZ").onchange=e=>update("z_index",Math.round(Number(e.target.value)||0));
  $("#toggleItemVisible").onclick=()=>{const i=selectedItem();if(i)update("visible",i.visible===false)};
  $("#removeItem").onclick=()=>{if(!state.selected)return;state.config.items=state.config.items.filter(i=>i.id!==state.selected);state.selected=null;dirty();editor()};
  $("#copySceneUrl").onclick=async()=>{const u=$("#sceneOutputUrl").value;if(u){await navigator.clipboard.writeText(u);toast("Scene Output URL kopiert.")}};
}

window.addEventListener?.("beforeunload",warnBeforeSceneUnload);
document.addEventListener("DOMContentLoaded",async()=>{
  const me=await CFS.requireAuth();if(!me)return;bind();
  try{await load();const params=new URLSearchParams(location.search),requestedScene=params.get("scene");if(requestedScene){const found=state.scenes.find(scene=>String(scene.id)===String(requestedScene));if(found){open(found.id);if(params.get("source")==="shop")toast(`Shop-Scene „${found.name}“ ist direkt zur Bearbeitung geöffnet.`)}else toast("Die verlinkte Shop-Scene ist nicht mehr vorhanden. Deine übrigen Scenes wurden nicht verändert.",true)}}catch(e){toast(e.message,true)}
});
})();