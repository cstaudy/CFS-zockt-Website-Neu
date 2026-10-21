/* R39 · non-destructive source-vs-output quality advisory; never claims a rendered-file check. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CFSR39CutQuality=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const finite=n=>Number.isFinite(Number(n))?Number(n):0;
function inspect({sourceWidth=0,sourceHeight=0,targetWidth=0,targetHeight=0,fps=30}={}){
 const sw=finite(sourceWidth),sh=finite(sourceHeight),tw=finite(targetWidth),th=finite(targetHeight);const notes=[];
 if(!(tw>0&&th>0))return{loaded:false,notes:['Zielformat ist noch nicht verfügbar.'],upscale:0};
 if(!(sw>0&&sh>0))return{loaded:false,notes:['Keine lokale Quellvideo-Metadaten geladen. Auflösung und Zuschnitt erst nach Dateiauswahl prüfbar.'],upscale:0};
 const fit=Math.max(tw/sw,th/sh),cropRatio=(Math.min(sw/sh,tw/th)/Math.max(sw/sh,tw/th));
 if(fit>1.5)notes.push(`Starke Vergrößerung auf ${tw} × ${th} (${fit.toFixed(1)}×): Schärfeverlust möglich.`);
 else if(fit>1.01)notes.push(`Quellvideo wird für ${tw} × ${th} vergrößert (${fit.toFixed(1)}×).`);
 if(cropRatio<.80)notes.push('Quell- und Zielformat unterscheiden sich deutlich. Prüfe wichtige Bildinhalte im Zuschnitt.');
 if(finite(fps)>=60)notes.push('60 FPS gewählt: Die tatsächliche Quell-Framerate lässt sich anhand von Browser-Metadaten nicht verlässlich prüfen.');
 if(!notes.length)notes.push('Quellauflösung und Zielseitenverhältnis passen grundsätzlich. Codec und fertiges Video erst im Launcher prüfen.');
 return{loaded:true,notes,upscale:fit,source:{width:sw,height:sh},target:{width:tw,height:th}};
}
function attach(){const box=document.getElementById('cutR39Quality'),video=document.getElementById('cutLocalVideo');if(!box||!video)return;
 const format=document.getElementById('cutFormat'),quality=document.getElementById('cutQuality'),fps=document.getElementById('cutFps');
 const button=document.getElementById('cutR39Inspect');
 function render(){const label=document.getElementById('cutExportSize')?.textContent||'',dims=label.match(/(\d+)\s*[×x]\s*(\d+)/);const defaults={vertical:[1080,1920],landscape:[1920,1080],square:[1080,1080]};const wh=dims?[Number(dims[1]),Number(dims[2])]:defaults[format?.value]||defaults.vertical;
 const ready=video.readyState>=1;const audit=inspect({sourceWidth:ready?video.videoWidth:0,sourceHeight:ready?video.videoHeight:0,targetWidth:wh[0],targetHeight:wh[1],fps:fps?.value||30});
 const headline=document.createElement('strong');headline.textContent=audit.loaded?`${video.videoWidth} × ${video.videoHeight} → ${wh[0]} × ${wh[1]}`:`Ziel: ${wh[0]} × ${wh[1]} · Quelle nicht geladen`;
 const summary=document.createElement('small');summary.textContent=`Qualität: ${quality?.selectedOptions?.[0]?.textContent||'Hoch'} · ${fps?.value||30} FPS · Nur Vorabprüfung, kein gerendertes Ergebnis.`;
 const ul=document.createElement('ul');for(const note of audit.notes){const li=document.createElement('li');li.textContent=note;ul.append(li)}
 box.replaceChildren(headline,summary,ul);box.dataset.loaded=String(audit.loaded);return audit;}
 button?.addEventListener('click',render);video.addEventListener('loadedmetadata',render);video.addEventListener('emptied',render);
 for(const el of [format,quality,fps])el?.addEventListener('change',render);
 document.getElementById('cutCheckExport')?.addEventListener('click',render);
 document.querySelectorAll('[data-cut-format]').forEach(el=>el.addEventListener('click',()=>requestAnimationFrame(render)));
 render();
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach()}
return{inspect,attach};
});
