/* R199: authenticated, conservative read-only website acceptance; all prior manual evidence expires on refresh. */
'use strict';
document.addEventListener('DOMContentLoaded',async()=>{
 const status=document.getElementById('r197Status');
 const refresh=document.getElementById('r197Refresh');
 const download=document.getElementById('r197Export');
 const setStatus=message=>{status.textContent=message;};
 const setNumber=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=Number.isInteger(n)?String(n):'–';};
 let summary={},currentLoad=0;
 download.disabled=true;
 let authenticated=false;
 try {authenticated=Boolean(await CFS.requireAuth());}
 catch {setStatus('Anmeldung konnte nicht geprüft werden. Bitte über das Dashboard anmelden.');return;}
 if(!authenticated){setStatus('Bitte zuerst anmelden. Keine Daten geladen.');return;}
 const reset=()=>{summary={};download.disabled=true;document.querySelectorAll('[data-r197-check]').forEach(el=>{el.checked=false;});for(const id of ['r197WidgetTotal','r197WidgetLive','r197SceneTotal','r197SceneLive','r198LinkedScenes','r198OrphanedScenes','r199MissingWidgets','r199NativeOnly'])setNumber(id,null);};
 async function load(){
   const loadId=++currentLoad;
   refresh.disabled=true;
   reset();
   setStatus('Prüfe Widget- und Scene-Verknüpfungen …');
   let timeoutHandle;
   try {
     const apiRequests=Promise.all([
       CFS.json('/api/creator/widget-studio/widgets'),
       CFS.json('/api/creator/widget-studio/scenes')
     ]);
     const timeout=new Promise((_,reject)=>{timeoutHandle=setTimeout(()=>reject(new Error('api_timeout')),12000);});
     const [widgets,scenes]=await Promise.race([apiRequests,timeout]);
     if(loadId!==currentLoad)return;
     if(!widgets?.ok||!scenes?.ok||!Array.isArray(widgets.widgets)||!Array.isArray(scenes.scenes))throw new Error('api_shape_invalid');
     summary=CFSR197.summary(widgets,scenes);
     if(!summary.accountApiOk)throw new Error('invalid_api_summary');
     setNumber('r197WidgetTotal',summary.widgetCount);
     setNumber('r197WidgetLive',summary.publishedWidgetCount);
     setNumber('r197SceneTotal',summary.sceneCount);
     setNumber('r197SceneLive',summary.publishedSceneCount);
     setNumber('r198LinkedScenes',summary.linkedSceneCount);
     setNumber('r198OrphanedScenes',summary.orphanedSceneCount);
     setNumber('r199MissingWidgets',summary.invalidWidgetRefCount);
     setNumber('r199NativeOnly',summary.nativeSceneCount);
     setStatus(summary.sourceCandidate
       ? 'Website-API erreichbar. Alle geprüften Widget-Verweise in befüllten Browser-Szenen sind gültig. Native Quellen und echte OBS-Darstellung separat prüfen.'
       : 'Website-API erreichbar, aber Szenen sind unvollständig, besitzen ungültige aktive Widget-Verweise oder ausschließlich native Quellen. Details prüfen. Keine automatische OBS-Freigabe.');
     download.disabled=false;
   } catch {
     if(loadId!==currentLoad)return;
     reset();
     setStatus('Website-Daten konnten nicht zuverlässig bestätigt werden (Fehler, Timeout oder ungültige Antwort). Login und Server prüfen. Keine Freigabe.');
   } finally {
     if(typeof clearTimeout==='function')clearTimeout(timeoutHandle);
     if(loadId===currentLoad)refresh.disabled=false;
   }
 }
 refresh.addEventListener('click',load);
 download.addEventListener('click',()=>{
   if(!summary?.accountApiOk)return;
   const manual={};
   document.querySelectorAll('[data-r197-check]').forEach(el=>{manual[el.dataset.r197Check]=el.checked===true;});
   const result=CFSR197.report({summary,manual});
   const blob=new Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='CFS_R197_WEBSITE_OBS_ABNAHME.json';a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 await load();
});
