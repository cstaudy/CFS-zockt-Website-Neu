/* R65: reference-style editor; uses existing authenticated Universal Builder backend. */
(()=>{'use strict';
const root=document.getElementById('ub65Mount');if(!root)return;
const $=s=>root.querySelector(s), $$=s=>[...root.querySelectorAll(s)];
const bridge=()=>window.CFSUniversalBuilder;
const PALETTES=[['Original','original'],['CFS Blau','#28b7ff'],['Cyan','#1de4eb'],['Electric Blue','#146eff'],['Sky','#58b4fc'],['Teal','#05c8a8'],['Grün','#22db91'],['Gold','#ffc146'],['Orange','#ff7942'],['Rot','#fd496b'],['Weiß','#e9f6ff'],['Violett','#af69ff'],['Pink','#ed4ce4'],['Magenta','#bd36fc'],['Eisblau','#a9e5ff'],['Rosé','#f6a1b6']];
const GENERAL=[{key:'starting',label:'Starting Soon',provider:'obs'},{key:'pause',label:'Pause / BRB',provider:'obs'},{key:'ending',label:'Stream Ending',provider:'obs'},{key:'social_bar',label:'Social-Leiste',provider:'obs'},{key:'sponsor',label:'Sponsor / Partner',provider:'obs'},{key:'text',label:'Text / Hinweis',provider:'obs'},{key:'image',label:'Bild / Logo',provider:'obs'}];
const state={ready:false,tab:'editor',saving:false,uploading:false,deleted:null,managing:false,snapEnabled:false,gridEnabled:false,selectedIds:new Set()};
// R99: ephemeral recovery per authenticated account + browser tab. No persistent full account cache.
const DRAFT_TTL=24*60*60*1000,DRAFT_LIMIT=256*1024;
let draftKey=null,draftTimer=null,draftPending=false,draftAwaitingDecision=false;
// R100: an acknowledged save only covers edits made before its request began.
let draftRevision=0;
function draftStatus(message){$('#ub99DraftStatus').textContent=message;}
function readDraft(){
 if(!draftKey)return null;
 try{
  const raw=sessionStorage.getItem(draftKey);if(!raw)return null;
  if(raw.length>DRAFT_LIMIT)throw Error('too big');
  const item=JSON.parse(raw);
  if(item?.schema!=='cfs-r99-session-draft-v1'||!Number.isFinite(item.at)||Date.now()-item.at>DRAFT_TTL||item.at>Date.now()+60000||!item.document?.config)throw Error('invalid');
  return item;
 }catch{try{sessionStorage.removeItem(draftKey)}catch{}return null;}
}
function showDraftActions(){
 const available=!!readDraft();$('#ub99DraftActions').hidden=!available;
 if(available)draftStatus('Ein ungespeicherter Entwurf dieses Kontos ist in diesem Tab vorhanden. Bitte wiederherstellen oder bewusst verwerfen, bevor neue Änderungen lokal gesichert werden.');
 else draftStatus(draftKey?'Keine lokale Wiederherstellung vorhanden. Änderungen werden innerhalb dieses Tabs gesichert.':'Lokale Sicherung auf dieser Umgebung nicht verfügbar. Bitte im Creator-Konto speichern.');
}
function removeDraft(){if(draftTimer){clearTimeout(draftTimer);draftTimer=null}draftPending=false;draftAwaitingDecision=false;if(draftKey)try{sessionStorage.removeItem(draftKey)}catch{}showDraftActions();}
function writeDraft(){
 if(draftTimer){clearTimeout(draftTimer);draftTimer=null}
 if(!draftKey||!state.ready||!draftPending||draftAwaitingDecision)return;
 draftPending=false;
 try{
  const doc=bridge()?.draftDocument($('#ub65Name').value);
  if(!doc)return removeDraft();
  // Only whitelisted portable fields; never save original asset IDs, private URLs or login state.
  const payload=JSON.stringify({schema:'cfs-r99-session-draft-v1',at:Date.now(),document:doc});
  if(payload.length>DRAFT_LIMIT)throw Error('limit');
  sessionStorage.setItem(draftKey,payload);
  draftStatus('Änderungen im Browser-Tab gesichert (nicht im Creator-Konto).');
  $('#ub99DraftActions').hidden=true;
 }catch{draftStatus('Lokale Sicherung fehlgeschlagen. Bitte jetzt im Creator-Konto speichern oder ein JSON-Backup erstellen.');}
}
function scheduleDraft(){draftRevision++;if(!draftKey||!state.ready)return;if(draftAwaitingDecision){draftStatus('Lokale Sicherung wartet auf deine Entscheidung. Bitte zuerst wiederherstellen oder verwerfen.');return;}draftPending=true;if(draftTimer)clearTimeout(draftTimer);draftTimer=setTimeout(writeDraft,250);}
function startDraftRecovery(){
 const scope=bridge()?.draftScope();draftKey=scope?'cfs-r99-draft:'+scope:null;
 draftAwaitingDecision=!!readDraft();showDraftActions();
}
function restoreDraft(){
 const item=readDraft();if(!item)return showDraftActions();
 if(snap()?.elements?.length&&!confirm('Lokalen Entwurf öffnen? Aktuelle, nicht gespeicherte Änderungen werden ersetzt.'))return;
 try{
  const result=bridge().importPortable(item.document,{replace:true});
  $('#ub65Name').value=result.name;syncForm();selectTab('editor');
  removeDraft();scheduleDraft();
  note('Lokaler Entwurf wiederhergestellt. Bitte prüfen, private Bilder neu zuordnen und anschließend im Creator-Konto speichern.');
 }catch(error){note('Wiederherstellung abgelehnt: '+error.message,true)}
}
const safeColor=(s,f='#28b7ff')=>/^#[0-9a-f]{6}$/i.test(String(s||''))?s:f;
const safeText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const snap=()=>bridge()?.snapshot();
function note(text,isError=false){const m=$('#ub65Message');m.hidden=!text;m.textContent=text;m.classList.toggle('error',isError)}
function setBusy(b){state.saving=!!b;['#ub65Save','#ub65Export','#ub65Add','#ub65New'].forEach(x=>$(x).disabled=!!b||!state.ready)}
function modeTypes(){const data=snap();if(!data?.ready)return[];const set=new Set();return [...GENERAL,...(data.registry||[]).filter(r=>r.available!==false).map(r=>({key:r.key,label:r.label||r.key,provider:r.provider||'obs'}))].filter(r=>{const id=r.provider+'|'+r.key;if(set.has(id))return false;set.add(id);return true})}
function elementCount(){const data=snap();const n=data?.elements?.length||0;$('#ub65ElementCount').textContent=`${n} Element${n===1?'':'e'} im Bundle`}
function getActive(){const d=snap();return d?.elements?.find(e=>e.id===d.activeId)||d?.elements?.at(-1)||null}
function updatePreview(){const data=snap();if(!data?.ready)return;
 const format=['landscape','vertical','square'].includes(data.settings?.format)?data.settings.format:'landscape';
 // The exact core R67 renderer draws the visible R65 stage and offline output.
 bridge().renderInto($('#ub65Stage'));
 const active=data.activeId;
 const selectedIds=state.selectedIds.size?state.selectedIds:new Set(active?[active]:[]);
 for(const item of $('#ub65Stage').querySelectorAll('[data-ub-id]')){
  const id=item.getAttribute('data-ub-id'),selected=selectedIds.has(id),element=data.elements.find(e=>e.id===id);
  item.classList.toggle('ub93-selected',selected);item.classList.toggle('ub97-locked',element?.locked===true);
  item.setAttribute('aria-selected',String(selected));
  item.setAttribute('aria-label',selected?'Ausgewähltes Element':'Element auswählen');
  item.tabIndex=0;
  if(selected&&!element?.locked&&selectedIds.size<=1&&$('#ub65Stage').classList.contains('cfs-r69-layout')){
   const handle=document.createElement('button');handle.type='button';handle.className='ub94-resize-handle';
   handle.setAttribute('aria-label','Elementgröße durch Ziehen ändern');handle.title='Größe ziehen';handle.tabIndex=0;item.append(handle);
  }
 }
 // R95: guides belong to the editor preview, never to saved designs or OBS HTML.
 const guides=document.createElement('div');guides.className='ub95-center-guides';guides.setAttribute('aria-hidden','true');
 guides.innerHTML='<span class="ub95-center-x"></span><span class="ub95-center-y"></span>';
 $('#ub65Stage').append(guides);
 const grid=document.createElement('div');grid.className='ub96-grid-overlay';grid.setAttribute('aria-hidden','true');
 $('#ub65Stage').append(grid);$('#ub65Stage').classList.toggle('ub96-grid-on',state.gridEnabled);
 const history=bridge().history();$('#ub94Undo').disabled=!history.canUndo;$('#ub94Redo').disabled=!history.canRedo;
 const dims={landscape:'16:9 · 1920 × 1080',vertical:'9:16 · 1080 × 1920',square:'1:1 · 1080 × 1080'};
 $('#ub65StageInfo').textContent=dims[format];elementCount();
}
function renderGallery(target='#ub65Gallery',term=''){const d=snap();if(!d?.ready)return;const list=(d.designs||[]).filter(x=>(x.label+' '+x.description).toLocaleLowerCase('de').includes(term.trim().toLocaleLowerCase('de')));const el=$(target);el.textContent='';list.forEach(design=>{const card=document.createElement('button');card.type='button';card.className='ub65-card'+(d.selectedDesign===design.key?' selected':'');card.dataset.designKey=design.key;card.setAttribute('aria-label',`${design.label} als Design verwenden`);card.innerHTML=`<div class="ub65-card-art" style="--art-accent:${safeColor(design.accent)};--art-back:${safeColor(design.surface,'#0b1522')}"><div class="ub65-art-panel"><span>${safeText(design.label)}</span><i></i></div></div><div class="ub65-card-info"><strong>${safeText(design.label)}</strong><span>${safeText(design.description||'Anpassbares Design')}</span></div>`;card.onclick=()=>chooseDesign(design.key);el.append(card)});if(!list.length)el.textContent='Keine passenden Designvorlagen gefunden.';$('#ub65GalleryCount').textContent=`${d.designs.length} Designwelten verfügbar`}
function libraryTemplates(){return Array.isArray(window.CFSR69Templates)?window.CFSR69Templates:[]}
function renderTemplateLibrary(){
 const input=$('#ub65LibrarySearch').value.trim().toLocaleLowerCase('de');
 const use=$('#ub69UseFilter').value,style=$('#ub69StyleFilter').value;
 const list=libraryTemplates().filter(t=>(!use||t.use===use)&&(!style||t.style===style)&&
   (!input||[t.name,t.description,t.use,t.style,t.format].join(' ').toLocaleLowerCase('de').includes(input)));
 const grid=$('#ub65LibraryGrid');grid.textContent='';
 for(const t of list){
  const b=document.createElement('button');b.type='button';b.className='ub69-card';b.dataset.templateId=t.id;
  b.setAttribute('aria-label',`${t.name} als bearbeitbare Vorlage öffnen`);
  const art=document.createElement('div');art.className='ub69-thumb '+t.format;
  art.dataset.canvas=t.transparency===1?'overlay':'screen';art.style.setProperty('--ub69-accent',safeColor(t.accent));art.style.setProperty('--ub69-bg',safeColor(t.background));
  const format=t.format==='vertical'?'9:16':t.format==='square'?'1:1':'16:9';
  const label=document.createElement('span');label.className='ub69-format';label.textContent=format;
  art.append(label);
  const dims={landscape:[1920,1080],vertical:[1080,1920],square:[1080,1080]}[t.format];
  for(const el of t.elements){const dot=document.createElement('i');dot.className='ub69-shape';
   dot.style.left=`${Math.min(98,Math.max(0,Number(el.position.x)/10))}%`;
   dot.style.top=`${Math.min(98,Math.max(0,Number(el.position.y)/10))}%`;
   dot.style.width=`${Number(el.size.width)/dims[0]*100}%`;dot.style.height=`${Number(el.size.height)/dims[1]*100}%`;
   art.append(dot);
  }
  const body=document.createElement('span');body.className='ub69-card-body';
  const heading=document.createElement('strong');heading.textContent=t.name;
  const meta=document.createElement('small');meta.textContent=`${t.use} · ${t.style} · OBS statisch`;
  const desc=document.createElement('span');desc.textContent=t.description;
  body.append(heading,meta,desc);b.append(art,body);b.onclick=()=>chooseTemplate(t);grid.append(b);
 }
 $('#ub69LibraryCount').textContent=`${list.length} von ${libraryTemplates().length} geprüften Vorlagen · bearbeitbar · OBS statisch`;
 if(!list.length){const empty=document.createElement('p');empty.textContent='Keine Vorlagen für diese Filter. Bitte Suche oder Filter zurücksetzen.';grid.append(empty)}
}
function chooseTemplate(t){
 const d=snap();if(!d?.ready)return note('Bitte erst anmelden und Builder laden.',true);
 if(d.elements.length&&!window.confirm('Neue Vorlage öffnen? Nicht gespeicherte Änderungen am aktuellen Entwurf gehen verloren. Gespeicherte Designs bleiben erhalten.'))return;
 const result=bridge().template(t.id,{replace:!!d.elements.length});
 if(!result)return note('Vorlage nicht verfügbar. Der bisherige Entwurf bleibt erhalten.',true);
 $('#ub65Name').value=t.name;syncForm();selectTab('editor');note(`„${t.name}“ geöffnet: ${result.count} bearbeitbare Elemente. Erst mit „Speichern“ wird daraus dein privates Design.`);
}
function renderModes(){const d=snap();const mode=$('#ub65Mode');const before=mode.value;mode.textContent='';modeTypes().forEach(x=>{const opt=document.createElement('option');opt.value=x.provider+'|'+x.key;opt.textContent=x.label+' · '+(x.provider==='obs'?'OBS / Statisch':x.provider.toUpperCase());mode.append(opt)});if([...mode.options].some(x=>x.value===before))mode.value=before;const n=mode.options.length;$('#ub65Available').textContent=`${d.designs.length} Designs · 16 Farben · ${n} verfügbare Elemente`}
function renderAssets(){const list=$('#ub65Assets');const assets=(snap()?.assets||[]).filter(x=>x.media_type==='image').slice(0,12);list.textContent='';assets.forEach(asset=>{const b=document.createElement('button');b.type='button';b.title=asset.name||asset.original_name||'Gespeichertes Bild';const path=String(asset.url||'');if(/^\/widget-assets\/[a-f0-9]{48}$/i.test(path)){const img=document.createElement('img');img.src=path;img.alt='';b.append(img)}else b.textContent='▧';const span=document.createElement('span');span.textContent=asset.name||asset.original_name||'Bild';b.append(span);b.onclick=()=>useImage(asset);list.append(b)});if(!assets.length)list.textContent='Nach deinem ersten Bild-Upload erscheinen hier deine Medien.'}
function renderSaved(){
 const list=$('#ub65SavedGrid'),rows=snap()?.bundles||[],query=$('#ub70SavedSearch').value.trim().toLocaleLowerCase('de'),sort=$('#ub70SavedSort').value;
 const visible=rows.filter(r=>!query||[r.name,...(r.elements||[]).map(e=>e.label||e.text||'')].join(' ').toLocaleLowerCase('de').includes(query));
 visible.sort((a,b)=>{if(sort==='name')return String(a.name||'').localeCompare(String(b.name||''),'de');
  const time=x=>Number.isFinite(Date.parse(x.updated_at||x.created_at||''))?Date.parse(x.updated_at||x.created_at):0;
  return (time(a)-time(b))*(sort==='oldest'?1:-1);
 });
 $('#ub70SavedCount').textContent=`${visible.length} von ${rows.length} gespeicherten Designs`;
 list.textContent='';for(const row of visible){
  const el=document.createElement('article');el.className='ub65-saved-card ub70-saved-card';
  const title=document.createElement('strong');title.textContent=row.name||'Mein Design';
  const sub=document.createElement('span');sub.textContent=`${row.elements?.length||0} Elemente · Privat · Version ${row.version||1}`;
  const actions=document.createElement('div');actions.className='ub70-card-actions';
  const action=(label,fn,danger=false)=>{const button=document.createElement('button');button.type='button';button.textContent=label;if(danger)button.classList.add('ub70-danger');button.onclick=fn;actions.append(button)};
  action('Öffnen',()=>openBundle(row));action('Umbenennen',()=>renameBundle(row));action('Duplizieren',()=>duplicateBundle(row));action('Backup (JSON)',()=>backupBundle(row));action('Löschen',()=>removeBundle(row),true);
  el.append(title,sub,actions);list.append(el);
 }
 if(!visible.length){const empty=document.createElement('p');empty.className='ub70-empty';empty.textContent=rows.length?'Keine Treffer. Suche oder Sortierung ändern.':'Noch keine Designs gespeichert. Erstelle dein erstes Design oder importiere ein JSON-Backup.';list.append(empty)}
}
async function manage(action,success){if(state.managing)return;state.managing=true;try{const result=await action();if(result!==false){renderSaved();note(success);}return result}catch(e){note(e.message||String(e),true);return false}finally{state.managing=false}}
async function renameBundle(row){const name=window.prompt('Neuen Namen für das Design eingeben:',row.name);if(name===null)return;await manage(()=>bridge().rename(row.id,name),`„${name.trim()}“ wurde umbenannt.`)}
async function duplicateBundle(row){const name=window.prompt('Name für die Kopie:',`${row.name} (Kopie)`);if(name===null)return;await manage(()=>bridge().duplicate(row.id,name.trim()),'Design wurde als eigenständige Kopie gespeichert. Das Original bleibt erhalten.')}
function backupBundle(row){try{const doc=bridge().portable(row.id);const blob=new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`cfs-design-${row.id.replace(/[^a-z0-9_-]/gi,'').slice(0,48)||'backup'}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);note(`„${row.name}“ als JSON-Backup bereitgestellt. ${doc.media_omitted?doc.media_omitted+' Medienreferenzen ausgelassen.':'Keine privaten Medienreferenzen enthalten.'}`)}catch(e){note('Backup fehlgeschlagen: '+e.message,true)}}
async function importBackup(file){if(!file||file.size<1||file.size>1024*1024){note('Bitte eine CFS-Design-JSON-Datei bis 1 MB auswählen.',true);return}
 try{const documentData=JSON.parse(await file.text());if(snap()?.elements?.length&&!window.confirm('Backup öffnen? Nicht gespeicherte Änderungen am aktuellen Entwurf gehen verloren. Bestehende Kontodesigns bleiben erhalten.'))return;
 const result=bridge().importPortable(documentData,{replace:true});$('#ub65Name').value=result.name;syncForm();selectTab('editor');note(`„${result.name}“ als neuer, ungespeicherter Entwurf importiert. ${result.mediaOmitted?'Bilder bei Bedarf erneut zuordnen. ':''}Erst nach „Speichern“ liegt das Design im Creator-Konto.`)}catch(e){note('Import abgelehnt: '+(e.message||String(e)),true)}
}
function showUndo(){const el=$('#ub70Undo');el.hidden=!state.deleted;$('#ub70UndoText').textContent=state.deleted?`„${state.deleted.name}“ wurde gelöscht. In diesem Tab kann eine neue Kopie wiederhergestellt werden.`:''}
async function restoreDeleted(){if(!state.deleted)return;const result=await manage(()=>bridge().restoreDeleted(state.deleted),'Design als neue Kopie wiederhergestellt.');if(result){state.deleted=null;showUndo()}}
function selectTab(tab){state.tab=tab;$$('[data-ub65-tab]').forEach(b=>{const yes=b.dataset.ub65Tab===tab;b.classList.toggle('active',yes);b.setAttribute('aria-selected',String(yes))});$('#ub65Editor').hidden=tab!=='editor';$('#ub65Library').hidden=tab!=='library';$('#ub65Saved').hidden=tab!=='saved';if(tab==='saved')renderSaved();if(tab==='library')renderTemplateLibrary();if(tab==='editor')updatePreview()}
function selectionIds(data=snap()){
 const ids=new Set((data?.elements||[]).map(e=>e.id));state.selectedIds=new Set([...state.selectedIds].filter(id=>ids.has(id)));
 if(!state.selectedIds.size&&data?.activeId)state.selectedIds.add(data.activeId);
 return [...state.selectedIds];
}
function setSelection(id,{toggle=false}={}){
 const data=snap(),item=data?.elements?.find(e=>e.id===id);if(!item)return;
 if(toggle){if(state.selectedIds.has(id))state.selectedIds.delete(id);else state.selectedIds.add(id);}
 else{state.selectedIds=new Set(bridge().selectedGroup(id));}
 if(!state.selectedIds.size)state.selectedIds.add(id);
 if(data.activeId!==id)bridge().selectElement(id);
 syncForm();
}
// R98: browser-only list filters and selection do not enter persisted design data.
function visibleLayers(data=snap()){
 const query=$('#ub98LayerSearch').value.trim().toLocaleLowerCase('de');
 const filter=$('#ub98LayerFilter').value;
 return (data?.elements||[]).filter(e=>{
  if(filter==='locked'&&e.locked!==true)return false;
  if(filter==='unlocked'&&e.locked===true)return false;
  if(filter==='grouped'&&!e.group_id)return false;
  return !query||[e.label,e.text,e.subtitle,e.source_key,e.widget_type].some(s=>String(s||'').toLocaleLowerCase('de').includes(query));
 });
}
function syncSelectionTools(data){
 const ids=selectionIds(data),members=data.elements.filter(e=>ids.includes(e.id)),composed=data.elements.some(e=>/^r69_/.test(String(e.id||'')));
 const list=$('#ub97SelectList');list.textContent='';
 const shown=visibleLayers(data),groupLabels=new Map();
 data.elements.forEach(e=>{if(e.group_id&&!groupLabels.has(e.group_id))groupLabels.set(e.group_id,groupLabels.size+1)});
 for(const e of shown){
  const row=document.createElement('label');row.className='ub97-choice ub98-layer-row';row.classList.toggle('ub98-selected',state.selectedIds.has(e.id));
  const input=document.createElement('input');input.type='checkbox';input.checked=state.selectedIds.has(e.id);
  input.setAttribute('aria-label',`Ebene ${e.label||e.text||e.id}${e.locked?' (gesperrt)':''} auswählen`);
  input.onchange=()=>setSelection(e.id,{toggle:true});
  const name=document.createElement('span');name.className='ub98-layer-name';
  const index=data.elements.findIndex(item=>item.id===e.id);
  name.textContent=`${index+1}. ${e.label||e.text||e.source_key||'Element'}`;
  const badge=document.createElement('small');badge.className='ub98-layer-badge';
  badge.textContent=[e.locked?'Gesperrt':'',e.group_id?'Gruppe '+groupLabels.get(e.group_id):''].filter(Boolean).join(' · ')||'Frei';
  row.append(input,name,badge);list.append(row);
 }
 if(!shown.length){const empty=document.createElement('p');empty.className='ub98-empty';empty.textContent='Keine Ebenen für diesen Filter.';list.append(empty)}
 $('#ub98VisibleCount').textContent=`${shown.length} von ${data.elements.length} Ebenen sichtbar`;
 $('#ub97Count').textContent=`${ids.length} von ${data.elements.length} ausgewählt`;
 $('#ub98SelectVisible').disabled=shown.length===0;
 $('#ub98OnlyActive').disabled=!data.activeId||(ids.length===1&&ids[0]===data.activeId);
 $('#ub98SelectGroup').disabled=!data.elements.some(e=>e.id===data.activeId&&e.group_id);
 $('#ub97Group').disabled=!composed||ids.length<2||members.some(e=>e.locked);
 $('#ub97Ungroup').disabled=!composed||!members.some(e=>e.group_id)||members.some(e=>e.locked);
 $('#ub97Lock').disabled=!members.length||members.every(e=>e.locked);
 $('#ub97Unlock').disabled=!members.some(e=>e.locked);
}
function syncForm(){const d=snap();if(!d?.ready)return;const settings=d.settings||{};$('#ub65Design').value=d.selectedDesign;$('#ub65Color').value=safeColor(settings.accent);$('#ub65Channel').value=settings.channel_name||'';$('#ub65Format').value=['vertical','square'].includes(settings.format)?settings.format:'landscape';$('#ub65Animation').value=['none','soft','pulse','glow','slide','pop'].includes(settings.animation)?settings.animation:'soft';$('#ub65Speed').value=Math.max(.25,Math.min(3,Number(settings.animation_speed)||1));$('#ub65SpeedValue').textContent=Number($('#ub65Speed').value).toLocaleString('de',{maximumFractionDigits:2})+' ×';const selected=(d.designs||[]).find(x=>x.key===d.selectedDesign)||{};const currentColor=safeColor(settings.accent);$('#ub65Palette').value=PALETTES.find(x=>x[1]===currentColor)?.[1]||'original';const selectedId=d.activeId;const selectedItem=d.elements.find(x=>x.id===selectedId)||getActive();
 const composed=d.elements.some(x=>/^r69_/.test(String(x.id||'')));
 const controls=$('#ub69LayoutSettings');controls.hidden=!composed||!selectedItem;
 if(composed&&selectedItem){const dim={landscape:[1920,1080],vertical:[1080,1920],square:[1080,1080]}[settings.format]||[1920,1080];
  $('#ub69X').value=Math.round((selectedItem.position?.x||0)/10);$('#ub69Y').value=Math.round((selectedItem.position?.y||0)/10);
  $('#ub69W').value=Math.round((selectedItem.size?.width||640)/dim[0]*100);$('#ub69H').value=Math.round((selectedItem.size?.height||120)/dim[1]*100);
 }
const picker=$('#ub65Elements');picker.textContent='';for(const [index,element] of d.elements.entries()){const o=document.createElement('option');o.value=element.id;o.textContent=`${index+1}. ${element.locked?'🔒 ':''}${element.label||element.source_key||'Element'}`;picker.append(o)}picker.disabled=!d.elements.length;const item=selectedItem;if(item)picker.value=item.id;$('#ub65Title').value=item?.text||'';$('#ub65Subtitle').value=item?.subtitle||'';$('#ub65Goal').value=item?.goal??100;$('#ub65Current').value=item?.metric||'';if(item){const id=`${item.platform}|${item.source_key||item.widget_type}`;if([...$('#ub65Mode').options].some(x=>x.value===id))$('#ub65Mode').value=id;}
 // R93: tools follow the selected element, its true layer index, and format capability.
 const layerIndex=d.elements.findIndex(x=>x.id===selectedItem?.id);
 const composedActive=composed&&layerIndex>=0&&!selectedItem?.locked;
 for(const id of ['#ub93Duplicate','#ub93Back','#ub93Front','#ub93Delete'])$(id).disabled=layerIndex<0||selectedItem?.locked===true||(id==='#ub93Duplicate'&&d.elements.length>=24)||(id==='#ub93Back'&&layerIndex===0)||(id==='#ub93Front'&&layerIndex===d.elements.length-1);
 for(const id of ['#ub93Left','#ub93Right','#ub93Up','#ub93Down'])$(id).disabled=!composedActive;
 for(const id of ['#ub65Title','#ub65Subtitle','#ub65Goal','#ub65Current','#ub69ApplyLayout'])$(id).disabled=!!selectedItem?.locked;
 syncSelectionTools(d);
 $('#ub93LayerHint').textContent=layerIndex<0?'Wähle ein Element zum Bearbeiten aus.':`Ebene ${layerIndex+1} von ${d.elements.length} · ${composed?'Position und Reihenfolge bearbeitbar':'Reihenfolge bearbeitbar'}`;
 const sourceColor=safeColor(selected.accent);$('#ub65Palette').title=`Originalfarbe der Designwelt: ${sourceColor}`;updatePreview()}
function chooseDesign(id){const d=snap(),row=(d?.designs||[]).find(x=>x.key===id);if(!row||!bridge().theme(row.key,row.accent))return;syncForm();renderGallery('#ub65Gallery',$('#ub65Search').value);renderTemplateLibrary();selectTab('editor');note(`Designwelt „${row.label}“ geladen. Du kannst sie anpassen und privat speichern.`)}
function addElement(){const [provider,key]=($('#ub65Mode').value||'').split('|');if(!provider||!key)return note('Bitte erst ein Element auswählen.',true);if(snap()?.elements?.length>=24)return note('Das Bundle darf maximal 24 Elemente enthalten.',true);const ok=bridge().add(key,provider);if(!ok){note('Dieser Elementtyp ist für deinen Plan oder die Plattform nicht verfügbar.',true);return}syncForm();note('Element hinzugefügt. Titel und Werte lassen sich jetzt links anpassen.')}
function currentElementUpdate(){const item=getActive();if(!item)return;bridge().editElement({text:$('#ub65Title').value,subtitle:$('#ub65Subtitle').value,goal:$('#ub65Goal').value,metric:$('#ub65Current').value});updatePreview()}
async function uploadFile(file){if(state.uploading)return;if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size<1||file.size>20*1024*1024){note('Bitte ein gültiges PNG-, JPG- oder WebP-Bild bis 20 MB wählen.',true);return}state.uploading=true;try{note('Bild wird geprüft und privat hochgeladen …');const asset=await bridge().upload(file);if(!asset)throw Error('Server hat keinen erfolgreichen Upload bestätigt.');await useImage(asset);renderAssets();note('Bild privat hochgeladen und im Bundle verwendet.')}catch(e){note('Bildimport fehlgeschlagen: '+e.message,true)}finally{state.uploading=false}}
async function useImage(asset){
 if(!snap()?.ready)return;
 // Do not overwrite an unrelated selected text/goal element when importing an image.
 if(getActive()?.type!=='image' && !bridge().add('image','obs'))throw Error('Es konnte kein Bild-Element erstellt werden.');
 if(!bridge().useAsset(asset,'active_element'))throw Error('Datei konnte nicht übernommen werden.');
 syncForm();selectTab('editor');
}
async function save(){
 if(state.saving)return;
 const data=snap();if(!data?.ready)return note('Bitte anmelden und Builder neu laden.',true);
 if(!data.elements.length||data.elements.length>24)return note('Zum Speichern sind 1 bis 24 Elemente erforderlich.',true);
 const name=$('#ub65Name').value.trim()||'Mein Streamdesign';
 const savingRevision=draftRevision;
 setBusy(true);
 try{
  const saved=await bridge().save(name);
  if(!saved?.id)throw Error('Speichern wurde nicht bestätigt.');
  // Do not erase local edits made while the server was responding.
  if(draftRevision===savingRevision&&($('#ub65Name').value.trim()||'Mein Streamdesign')===name){
   removeDraft();note(`„${saved.name}“ wurde privat im Creator-Konto gespeichert.`);
  }else{
   scheduleDraft();
   // Flush immediately: the save has finished, but the latest edits have not.
   writeDraft();
   note('Design gespeichert. Neuere Änderungen sind noch ungespeichert und bleiben als lokaler Entwurf erhalten.');
  }
  renderSaved();
 }catch(e){
  // An optimistic lock, timeout or network fault MUST NOT erase the draft.
  writeDraft();note(e.message,true);
 }finally{setBusy(false)}
}
async function refresh(){try{await bridge().refresh();renderSaved();renderAssets();note('Gespeicherte Designs aktualisiert.')}catch(e){note('Aktualisieren fehlgeschlagen: '+e.message,true)}}
function openBundle(row){if(snap()?.elements.length&&!confirm('Gespeichertes Design öffnen? Ungespeicherte Änderungen gehen verloren.'))return;if(!bridge().open(row.id))return note('Das Design konnte nicht geöffnet werden.',true);$('#ub65Name').value=row.name;syncForm();renderGallery();selectTab('editor');note(`„${row.name}“ geöffnet. Du kannst es jetzt weiter bearbeiten.`)}
async function removeBundle(row){if(!confirm(`„${row.name}“ wirklich löschen? Sichere es bei Bedarf zuerst als JSON-Backup. Danach gibt es nur in diesem geöffneten Tab eine einfache Wiederherstellung als neue Kopie.`))return;
 const result=await manage(()=>bridge().remove(row.id),'Design gelöscht. Eine Wiederherstellung als neue Kopie ist in diesem Tab möglich.');if(result){state.deleted=JSON.parse(JSON.stringify(row));showUndo()}}

function showAdvanced(){const app=document.getElementById('builderApp'),open=app.classList.toggle('ub65-show-advanced');$('#ub65Advanced').setAttribute('aria-expanded',String(open));$('#ub65Advanced').textContent=open?'Erweiterten Editor schließen ▴':'Erweiterter Editor ▾';if(open){bridge()?.advanced('content');document.getElementById('ubLegacyWizard').scrollIntoView({block:'start',behavior:'smooth'});}}
function init(){const d=snap();if(state.ready||!d?.ready)return;state.ready=true;const design=$('#ub65Design');d.designs.forEach(x=>{const o=document.createElement('option');o.value=x.key;o.textContent=x.label;design.append(o)});const palette=$('#ub65Palette');PALETTES.forEach(([label,value])=>{const o=document.createElement('option');o.value=value;o.textContent=label;palette.append(o)});renderModes();renderGallery();renderTemplateLibrary();renderAssets();renderSaved();syncForm();$('#ub65Name').value='Mein Streamdesign';startDraftRecovery();$('#ub65Plan').textContent=`${d.designs.length} Designwelten · Creator Beta`;note('Bereit. Wähle eine Designwelt, füge ein Element hinzu und speichere deinen Entwurf.');if(location.hash==='#meine-designs')selectTab('saved');else if(location.hash==='#vorlagen')selectTab('library')}
$$('[data-ub65-tab]').forEach(b=>b.onclick=()=>{const t=b.dataset.ub65Tab;selectTab(t);history.replaceState(null,'',({editor:'#erstellen',library:'#vorlagen',saved:'#meine-designs'})[t]);});
window.addEventListener('hashchange',()=>{const t=({'#erstellen':'editor','#vorlagen':'library','#meine-designs':'saved'})[location.hash];if(t&&state.ready)selectTab(t)});$('#ub65Advanced').onclick=showAdvanced;$('#ub65OpenLegacy').onclick=showAdvanced;
$('#ub65Design').onchange=e=>chooseDesign(e.target.value);
$('#ub65Palette').onchange=e=>{const v=e.target.value;const d=snap(),row=d?.designs?.find(x=>x.key===d.selectedDesign);const color=v==='original'?row?.accent:v;bridge().palette(safeColor(color));syncForm()};
$('#ub65Color').oninput=e=>{bridge()?.palette(e.target.value);syncForm()};$('#ub65Format').onchange=e=>{bridge()?.settings({format:e.target.value});updatePreview()};
$('#ub65Animation').onchange=e=>{bridge()?.settings({animation:e.target.value});updatePreview()};$('#ub65Speed').oninput=e=>{bridge()?.settings({animation_speed:Number(e.target.value)});$('#ub65SpeedValue').textContent=Number(e.target.value).toLocaleString('de')+' ×'};
$('#ub65Channel').oninput=e=>{bridge()?.settings({channel_name:e.target.value});updatePreview()};['#ub65Title','#ub65Subtitle','#ub65Goal','#ub65Current'].forEach(id=>$(id).oninput=currentElementUpdate);
$('#ub65Elements').onchange=e=>setSelection(e.target.value);
 $('#ub98LayerSearch').oninput=()=>syncSelectionTools(snap());
 $('#ub98LayerFilter').onchange=()=>syncSelectionTools(snap());
 $('#ub98SelectVisible').onclick=()=>{
  const ids=visibleLayers().map(e=>e.id);if(!ids.length)return;
  state.selectedIds=new Set(ids);syncForm();note(`${ids.length} sichtbare Ebenen ausgewählt. Gesperrte Ebenen können nur entsperrt werden.`);
 };
 $('#ub98SelectGroup').onclick=()=>{
  const d=snap(),active=d?.elements.find(e=>e.id===d.activeId);
  if(!active?.group_id)return note('Aktives Element gehört keiner Gruppe an.',true);
  state.selectedIds=new Set(d.elements.filter(e=>e.group_id===active.group_id).map(e=>e.id));
  syncForm();note(`${state.selectedIds.size} Gruppenelemente ausgewählt – auch gesperrte.`);
 };
 $('#ub98OnlyActive').onclick=()=>{
  const active=snap()?.activeId;if(!active)return;
  state.selectedIds=new Set([active]);syncForm();note('Nur aktives Element ausgewählt.');
 };
 $('#ub97Group').onclick=()=>{const id=bridge().groupElements(selectionIds());if(!id)return note('Mindestens zwei ungesperrte Elemente auswählen.',true);state.selectedIds=new Set(bridge().selectedGroup(snap().activeId));syncForm();note('Elemente gruppiert. Gemeinsam bewegen oder später Gruppe lösen.');};
 $('#ub97Ungroup').onclick=()=>{if(!bridge().ungroupElements(selectionIds()))return note('Gruppe nicht verfügbar oder gesperrt.',true);syncForm();note('Gruppe gelöst; Positionen bleiben erhalten.');};
 $('#ub97Lock').onclick=()=>{if(!bridge().lockElements(selectionIds(),true))return note('Bitte ungesperrte Elemente auswählen.',true);syncForm();note('Ausgewählte Ebenen gesperrt.');};
 $('#ub97Unlock').onclick=()=>{if(!bridge().lockElements(selectionIds(),false))return note('Keine gesperrten Ebenen ausgewählt.',true);syncForm();note('Ausgewählte Ebenen entsperrt.');};
 function layerAction(name){const id=snap()?.activeId;if(!id)return note('Bitte erst ein Element auswählen.',true);
  let ok=false;
  if(name==='duplicate')ok=!!bridge().duplicateElement(id);
  if(name==='back'||name==='front')ok=bridge().moveElement(id,name==='back'?'backward':'forward');
  if(name==='delete'){
   if(!window.confirm('Ausgewähltes Element entfernen? Gespeicherte Designs bleiben unverändert.'))return;
   ok=bridge().removeElement(id);
  }
  if(!ok)return note(name==='duplicate'?'Maximal 24 Elemente oder ungültige Auswahl.':'Aktion an dieser Position nicht möglich.',true);
  syncForm();note(name==='duplicate'?'Element als unabhängige Kopie erstellt.':name==='delete'?'Element aus dem Entwurf entfernt.':'Ebenenreihenfolge geändert.');
 }
 [['#ub93Duplicate','duplicate'],['#ub93Back','back'],['#ub93Front','front'],['#ub93Delete','delete']].forEach(([id,op])=>$(id).onclick=()=>layerAction(op));
 [['#ub93Left',-10,0],['#ub93Right',10,0],['#ub93Up',0,-10],['#ub93Down',0,10]].forEach(([id,dx,dy])=>$(id).onclick=()=>{
  const selected=snap()?.activeId;
  const ids=selectionIds();if(!selected||!(ids.length>1?bridge().moveElements(ids,dx,dy):bridge().nudgeElement(selected,dx,dy)))return note('Auswahl ist gesperrt oder kann nicht weiter bewegt werden.',true);
  syncForm();note('Element um 1 % verschoben.');
 });
 // Select individual elements directly on the R93 preview; the stage itself remains a pure renderer.
 $('#ub65Stage').addEventListener('click',event=>{
  const item=event.target.closest('[data-ub-id]');if(!item||!$('#ub65Stage').contains(item))return;
  setSelection(item.getAttribute('data-ub-id'),{toggle:!!(event.ctrlKey||event.metaKey)});
 });
 $('#ub65Stage').addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  const item=event.target.closest('[data-ub-id]');if(!item)return;
  event.preventDefault();setSelection(item.getAttribute('data-ub-id'),{toggle:!!(event.ctrlKey||event.metaKey)});
 });
 // R94: pointer gesture is visual-only until release; one validated core mutation = one undo step.
 const stage=$('#ub65Stage');let gesture=null,skipStageClick=false;
 const sizes={landscape:[1920,1080],vertical:[1080,1920],square:[1080,1080]};
 const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
 const clearGuides=()=>{
  stage.classList.remove('ub95-snap-x','ub95-snap-y','ub96-gap-x','ub96-gap-y');
  stage.style.removeProperty('--ub96-guide-x');stage.style.removeProperty('--ub96-guide-y');
 };
 const targetBox=(e,dim)=>({
  x:Number(e.position?.x)||0,y:Number(e.position?.y)||0,
  w:Number(e.size?.width)/dim[0]*1000,h:Number(e.size?.height)/dim[1]*1000
 });
 // R96: all math is in the same 0..1000 coordinates as the stored configuration.
 // Pick the nearest alignment independently per axis. Old R95 centre snapping wins
 // before peer-alignment; grid rounding is only a fallback and opt-in separately.
 const peerCandidate=(g,patch,axis)=>{
  const isX=axis==='x',start=isX?'x':'y',len=isX?'w':'h';
  const ourLen=(isX?g.width/g.dim[0]:g.height/g.dim[1])*1000;
  const p=patch.position[start],others=g.peers||[],available=[];
  for(const e of others){
   const anchors=[e[start],e[start]+e[len]/2,e[start]+e[len]];
   for(const anchor of anchors){
    for(const ownAnchor of [0,ourLen/2,ourLen]){
     const value=Math.round(anchor-ownAnchor);
     available.push({value,guide:anchor,kind:'peer'});
    }
   }
  }
  // Equal visible gaps between two neighbors. Only propose a target when the
  // moved element would actually fit between them and overlap their cross-axis.
  for(let i=0;i<others.length;i++)for(let j=i+1;j<others.length;j++){
   const [left,right]=others[i][start]<=others[j][start]?[others[i],others[j]]:[others[j],others[i]];
   const before=left[start]+left[len],after=right[start],free=after-before;
   if(free<=ourLen+12)continue;
   const otherStart=isX?'y':'x',otherLen=isX?'h':'w';
   const position=patch.position[otherStart];
   const crossLen=(isX?g.height/g.dim[1]:g.width/g.dim[0])*1000;
   const overlap=o=>Math.max(position,o[otherStart])<Math.min(position+crossLen,o[otherStart]+o[otherLen]);
   if(!overlap(left)||!overlap(right))continue;
   const value=Math.round((before+after-ourLen)/2);
   available.push({value,guide:value+ourLen/2,kind:'gap'});
  }
  const max=1000-ourLen;
  return available
   .filter(c=>c.value>=0&&c.value<=max&&Math.abs(c.value-p)<=12)
   .sort((a,b)=>Math.abs(a.value-p)-Math.abs(b.value-p)||(a.kind==='gap'?-1:1))[0]||null;
 };
 const adjustSnap=(g,patch)=>{
  let x=false,y=false,xAt=500,yAt=500,spaceX=false,spaceY=false;
  if(g.resize)return {x,y,xAt,yAt,spaceX,spaceY};
  if(state.snapEnabled){
   const centerX=Math.round(500-g.width/g.dim[0]*500);
   const centerY=Math.round(500-g.height/g.dim[1]*500);
   if(Math.abs(patch.position.x-centerX)<=12){patch.position.x=clamp(centerX,0,1000);x=true;}
   else{const c=peerCandidate(g,patch,'x');if(c){patch.position.x=c.value;x=true;xAt=c.guide;spaceX=c.kind==='gap';}}
   if(Math.abs(patch.position.y-centerY)<=12){patch.position.y=clamp(centerY,0,1000);y=true;}
   else{const c=peerCandidate(g,patch,'y');if(c){patch.position.y=c.value;y=true;yAt=c.guide;spaceY=c.kind==='gap';}}
  }
  if(state.gridEnabled){
   const maxX=Math.floor(1000-g.width/g.dim[0]*1000),maxY=Math.floor(1000-g.height/g.dim[1]*1000);
   if(!x)patch.position.x=clamp(Math.round(patch.position.x/50)*50,0,maxX);
   if(!y)patch.position.y=clamp(Math.round(patch.position.y/50)*50,0,maxY);
  }
  return {x,y,xAt,yAt,spaceX,spaceY};
 };
 const markGuides=hits=>{
  stage.classList.toggle('ub95-snap-x',hits.x);stage.classList.toggle('ub95-snap-y',hits.y);
  stage.classList.toggle('ub96-gap-x',hits.spaceX);stage.classList.toggle('ub96-gap-y',hits.spaceY);
  stage.style.setProperty('--ub96-guide-x',(hits.xAt/10)+'%');
  stage.style.setProperty('--ub96-guide-y',(hits.yAt/10)+'%');
 };
 const snapButton=$('#ub95Snap');
 snapButton.onclick=()=>{
  state.snapEnabled=!state.snapEnabled;
  snapButton.setAttribute('aria-pressed',String(state.snapEnabled));
  snapButton.textContent=state.snapEnabled?'Einrasten: An':'Einrasten: Aus';
  if(!state.snapEnabled)clearGuides();
  note(state.snapEnabled?'Ausrichtung an Mitte, Elementen und gleichen Zwischenräumen aktiv.':'Einrasten an Elementen ausgeschaltet.');
 };
 const gridButton=$('#ub96Grid');
 gridButton.onclick=()=>{
  state.gridEnabled=!state.gridEnabled;
  gridButton.setAttribute('aria-pressed',String(state.gridEnabled));
  gridButton.textContent=state.gridEnabled?'Raster: An':'Raster: Aus';
  stage.classList.toggle('ub96-grid-on',state.gridEnabled);
  note(state.gridEnabled?'5-%-Raster für das Verschieben aktiv.':'Raster ausgeschaltet.');
 };
 const metric=(g,x,y)=>{
  const dx=(x-g.x)/g.rect.width,dy=(y-g.y)/g.rect.height;
  if(g.resize){
   const width=clamp(g.width+Math.round(dx*g.dim[0]),20,g.dim[0]);
   const height=clamp(g.height+Math.round(dy*g.dim[1]),20,g.dim[1]);
   return {position:{x:clamp(g.left,0,Math.floor(1000-width/g.dim[0]*1000)),y:clamp(g.top,0,Math.floor(1000-height/g.dim[1]*1000))},size:{width,height}};
  }
  return {position:{x:clamp(g.left+Math.round(dx*1000),0,Math.floor(1000-g.width/g.dim[0]*1000)),y:clamp(g.top+Math.round(dy*1000),0,Math.floor(1000-g.height/g.dim[1]*1000))}};
 };
 stage.addEventListener('pointerdown',event=>{
  if(event.button!==0||state.saving||!stage.classList.contains('cfs-r69-layout'))return;
  const item=event.target.closest('[data-ub-id]');if(!item||!stage.contains(item))return;
  const id=item.getAttribute('data-ub-id');
  if(event.ctrlKey||event.metaKey){setSelection(id,{toggle:true});event.preventDefault();skipStageClick=true;setTimeout(()=>{skipStageClick=false;},0);return;}
  if(!state.selectedIds.has(id))setSelection(id);
  const d=snap(),e=d.elements.find(x=>x.id===id);if(!e||e.locked)return;
  const ids=selectionIds(d);if(ids.some(key=>d.elements.find(e=>e.id===key)?.locked))return;
  if(d.activeId!==id)bridge().selectElement(id);

  const rect=stage.getBoundingClientRect(),dim=sizes[d.settings?.format]||sizes.landscape;
  if(!rect.width||!rect.height)return;
  // Selecting another layer redraws the stage. Use the new live element, not a stale DOM node.
  const liveItem=[...stage.querySelectorAll('[data-ub-id]')].find(node=>node.getAttribute('data-ub-id')===id)||item;
  clearGuides();
  gesture={id,ids,pointerId:event.pointerId,x:event.clientX,y:event.clientY,rect,dim,left:Number(e.position?.x)||0,top:Number(e.position?.y)||0,width:Number(e.size?.width)||640,height:Number(e.size?.height)||120,resize:ids.length===1&&!!event.target.closest('.ub94-resize-handle'),moved:false,element:liveItem,groupItems:ids.filter(key=>key!==id).map(key=>({node:[...stage.querySelectorAll('[data-ub-id]')].find(node=>node.getAttribute('data-ub-id')===key),item:d.elements.find(e=>e.id===key)})),peers:d.elements.filter(item=>!ids.includes(item.id)&&item.position&&item.size).map(item=>targetBox(item,dim))};
  if(stage.setPointerCapture)stage.setPointerCapture(event.pointerId);
  event.preventDefault();
 });
 stage.addEventListener('pointermove',event=>{
  const g=gesture;if(!g||event.pointerId!==g.pointerId)return;
  if(Math.hypot(event.clientX-g.x,event.clientY-g.y)<3&&!g.moved)return;
  g.moved=true;const patch=metric(g,event.clientX,event.clientY);
  markGuides(g.ids.length>1?{x:false,y:false,xAt:500,yAt:500,spaceX:false,spaceY:false}:adjustSnap(g,patch));
  const dx=patch.position.x-g.left,dy=patch.position.y-g.top;for(const other of g.groupItems){if(other.node){other.node.style.left=((Number(other.item.position?.x)||0)+dx)/10+'%';other.node.style.top=((Number(other.item.position?.y)||0)+dy)/10+'%';}}
  g.element.style.left=patch.position.x/10+'%';g.element.style.top=patch.position.y/10+'%';
  if(patch.size){g.element.style.width=patch.size.width/g.dim[0]*100+'%';g.element.style.height=patch.size.height/g.dim[1]*100+'%';}
  event.preventDefault();
 });
 const finishGesture=(event,cancel=false)=>{
  const g=gesture;if(!g||event.pointerId!==g.pointerId)return;
  gesture=null;if(stage.hasPointerCapture?.(event.pointerId))stage.releasePointerCapture(event.pointerId);
  clearGuides();
  if(cancel||!g.moved){if(cancel)updatePreview();return;}
  skipStageClick=true;setTimeout(()=>{skipStageClick=false;},0);
  const patch=metric(g,event.clientX,event.clientY),hits=g.ids.length>1?{x:false,y:false,spaceX:false,spaceY:false}:adjustSnap(g,patch);
  const ids=g.ids;const moved=ids.length>1?bridge().moveElements(ids,patch.position.x-g.left,patch.position.y-g.top):(bridge().selectElement(g.id)&&bridge().editElement(patch));
  if(!moved)return updatePreview();
  syncForm();note(g.resize?'Elementgröße angepasst. Rückgängig ist möglich.':
   hits.spaceX||hits.spaceY?'Element mit gleichen Abständen ausgerichtet.':
   hits.x&&hits.y?'Element an Hilfslinien ausgerichtet. Rückgängig ist möglich.':
   hits.x||hits.y?'Element an der Bühne oder an Nachbarelementen ausgerichtet.':'Element verschoben. Rückgängig ist möglich.');
 };
 stage.addEventListener('pointerup',event=>finishGesture(event));
 stage.addEventListener('pointercancel',event=>finishGesture(event,true));
 stage.addEventListener('lostpointercapture',event=>{if(gesture&&event.pointerId===gesture.pointerId){gesture=null;clearGuides();updatePreview();}});
 stage.addEventListener('click',event=>{if(skipStageClick){event.stopImmediatePropagation();skipStageClick=false;}},true);
 const historyAction=direction=>{if(gesture)return;const done=direction==='undo'?bridge().undo():bridge().redo();if(done){syncForm();note(direction==='undo'?'Änderung rückgängig gemacht.':'Änderung wiederhergestellt.');}};
 $('#ub94Undo').onclick=()=>historyAction('undo');$('#ub94Redo').onclick=()=>historyAction('redo');
 document.addEventListener('keydown',event=>{
  if(state.tab!=='editor'||!event.ctrlKey&&!event.metaKey||event.altKey)return;
  const target=event.target;if(target?.matches?.('input,textarea,select,[contenteditable], [contenteditable] *'))return;
  const key=event.key.toLowerCase();
  if(key==='z'){event.preventDefault();historyAction(event.shiftKey?'redo':'undo');}
  else if(key==='y'){event.preventDefault();historyAction('redo');}
 });
 $('#ub99Restore').onclick=restoreDraft;
 $('#ub99Discard').onclick=()=>{if(confirm('Lokale Sicherung dieses Browser-Tabs wirklich verwerfen? Gespeicherte Creator-Designs bleiben erhalten.'))removeDraft()};
 $('#ub65Name').addEventListener('input',scheduleDraft);
 window.addEventListener('pagehide',writeDraft);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')writeDraft()});
 $('#ub65Add').onclick=addElement;$('#ub65Save').onclick=save;$('#ub65Load').onclick=()=>selectTab('saved');$('#ub65Export').onclick=async()=>{if(!snap()?.elements?.length)return note('Bitte erst mindestens ein Element erstellen.',true);if(state.saving)return;setBusy(true);note('Bilder für den Offline-Export werden geprüft …');try{const success=await bridge().exportZip();note(success?'OBS-ZIP vollständig erstellt. Die enthaltenen Bilder funktionieren offline; Live-Daten sind nicht enthalten.':bridge().exportError(),!success)}catch(error){note('Export fehlgeschlagen: '+error.message,true)}finally{setBusy(false)}};$('#ub65Restart').onclick=()=>{updatePreview();note('Vorschau aus den aktuellen Einstellungen neu aufgebaut.')};$('#ub65New').onclick=()=>{if(snap()?.elements?.length&&!confirm('Neues leeres Design erstellen? Nicht gespeicherte Änderungen gehen verloren.'))return;bridge().clear();$('#ub65Name').value='Neues Streamdesign';syncForm();note('Neuer leerer Entwurf. Vorhandene gespeicherte Designs bleiben unverändert.')};
$('#ub69ApplyLayout').onclick=()=>{
 const d=snap(),format=d.settings?.format||'landscape';const dims={landscape:[1920,1080],vertical:[1080,1920],square:[1080,1080]}[format];
 const percent=id=>Math.max(0,Math.min(100,Number($(id).value)||0));
 const patch={position:{x:Math.round(percent('#ub69X')*10),y:Math.round(percent('#ub69Y')*10)},
  size:{width:Math.round(Math.max(1,percent('#ub69W'))/100*dims[0]),height:Math.round(Math.max(1,percent('#ub69H'))/100*dims[1])}};
 if(!bridge().editElement(patch))return note('Bitte zuerst ein Element einer R69-Vorlage auswählen.',true);
 syncForm();note('Position und Größe übernommen. Vorschau und statischer OBS-Export verwenden dieselben Werte.');
 };
 $('#ub65Search').oninput=e=>renderGallery('#ub65Gallery',e.target.value);$('#ub65LibrarySearch').oninput=renderTemplateLibrary;$('#ub69UseFilter').onchange=renderTemplateLibrary;$('#ub69StyleFilter').onchange=renderTemplateLibrary;$('#ub65Refresh').onclick=refresh;$('#ub70SavedSearch').oninput=renderSaved;$('#ub70SavedSort').onchange=renderSaved;$('#ub70Restore').onclick=restoreDeleted;$('#ub70ImportFile').onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(file)importBackup(file)};
$('#ub65File').onchange=e=>{const files=[...e.target.files];e.target.value='';if(files.length===1)uploadFile(files[0]);else note('Bitte genau eine Datei auswählen.',true)};const drop=$('#ub65Drop');for(const event of ['dragenter','dragover'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add('dragover')});for(const event of ['dragleave','drop'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('dragover')});drop.addEventListener('drop',e=>{const files=[...e.dataTransfer.files];if(files.length!==1)return note('Bitte genau ein Bild pro Ablage importieren.',true);uploadFile(files[0])});
window.addEventListener('cfs:builder-changed',e=>{
 if(!state.ready)return;
 const kind=e.detail?.kind;
 if(['open','clear','template','undo','redo','duplicate','add','remove'].includes(kind)){state.selectedIds=new Set(snap()?.activeId?[snap().activeId]:[]);}
 if(kind==='clear'||kind==='open')removeDraft();
 else if(!['select','refresh','saved','removed-bundle','assets'].includes(kind))scheduleDraft();
 // Selection, open and structural edits affect forms; text input must keep focus/caret.
 const typing=root.contains(document.activeElement)&&['INPUT','TEXTAREA'].includes(document.activeElement?.tagName);
 if(!typing||['open','clear','add','remove','select','template','duplicate','reorder','move'].includes(kind))syncForm();else updatePreview();
 if(['assets','asset','refresh'].includes(kind))renderAssets();
 if(['saved','refresh','removed-bundle'].includes(kind))renderSaved();
});
// R102: a revoked session invalidates all cached private UI, including the
// R70 cards and thumbnails. A new login requires a fresh page load.
window.addEventListener('cfs:builder-session-ending',writeDraft);
window.addEventListener('cfs:builder-session-expired',()=>{
 state.ready=false;state.selectedIds.clear();state.deleted=null;
 for(const id of ['ub65Stage','ub65Assets','ub65SavedGrid','ub97SelectList']){
  const el=$('#'+id);if(el)el.replaceChildren();
 }
 $('#ub70SavedCount').textContent='Sitzung abgelaufen – bitte neu anmelden.';
 $('#ub70Undo').hidden=true;$('#ub65ElementCount').textContent='0 Elemente';
 root.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);
 note('Deine Sitzung ist abgelaufen. Private Designs und Bilder wurden ausgeblendet. Bitte neu anmelden und die Seite neu laden.',true);
});
window.addEventListener('cfs:builder-ready',init);window.addEventListener('cfs:builder-error',e=>note('Builder nicht verfügbar: '+(e.detail?.message||'Bitte Anmeldung prüfen.'),true));if(snap()?.ready)init();
})();
