/* R41 – shared, non-destructive design preflight. Geometry/metadata only: no claim to validate rendered frames. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CFSR41OutputAudit=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const finite=value=>typeof value==='number'?Number.isFinite(value):value!==null&&value!==''&&Number.isFinite(Number(value));
const numeric=(value,fallback=0)=>finite(value)?Number(value):fallback;
const bound=(value,min,max)=>Math.max(min,Math.min(max,value));
function report(kind,w,h){return {kind,dimensions:`${w} × ${h}`,errors:[],warnings:[],notes:[],findings:[],stats:{total:0,visible:0}};}
function issue(out,severity,text,elementId=null,action=null,code=null){const message=String(text);out[severity].push(message);out.findings.push({severity,text:message,elementId:elementId==null?null:String(elementId),action,code:code||message});}
function dimensions(config){const w=numeric(config?.canvas?.width),h=numeric(config?.canvas?.height);return {w,h,ok:Number.isInteger(w)&&Number.isInteger(h)&&w>=64&&h>=64&&w<=3840&&h<=3840};}
function bounds(x,y,w,h,rotation=0){const r=numeric(rotation)*Math.PI/180,c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r)),bw=w*c+h*s,bh=w*s+h*c;return {x:x+(w-bw)/2,y:y+(h-bh)/2,w:bw,h:bh};}
/* R54: Scene renderer transforms around top-left; scale then rotation. */
function sceneRenderBounds(x,y,w,h,scale=1,rotation=0){
 const [xx,yy,ww,hh,ss,rr]=[x,y,w,h,scale,rotation].map(Number);
 if(![xx,yy,ww,hh,ss,rr].every(Number.isFinite)||ww<=0||hh<=0||ss<=0)return{x:NaN,y:NaN,w:0,h:0};
 const a=rr*Math.PI/180,c=Math.cos(a)*ss,s=Math.sin(a)*ss;
 const pointsX=[0,ww*c,-hh*s,ww*c-hh*s],pointsY=[0,ww*s,hh*c,ww*s+hh*c];
 const minX=Math.min(...pointsX),minY=Math.min(...pointsY);
 return{x:xx+minX,y:yy+minY,w:Math.max(...pointsX)-minX,h:Math.max(...pointsY)-minY};
}
function visibleRatio(rect,W,H){if(![rect.x,rect.y,rect.w,rect.h,W,H].every(Number.isFinite)||rect.w<=0||rect.h<=0)return 0;const ix=Math.max(0,Math.min(W,rect.x+rect.w)-Math.max(0,rect.x)),iy=Math.max(0,Math.min(H,rect.y+rect.h)-Math.max(0,rect.y));return bound(ix*iy/(rect.w*rect.h),0,1);}
function isTransparent(color){return !color||String(color).trim().toLowerCase()==='transparent'||color==='rgba(0,0,0,0)';}
function finish(out){out.status=out.errors.length?'error':out.warnings.length?'warning':'ok';out.summary=out.errors.length?`${out.errors.length} Fehler · ${out.warnings.length} Hinweise`:out.warnings.length?`${out.warnings.length} Hinweise · keine kritischen Fehler`:'Keine geometrischen Probleme erkannt';return out;}
function analyzeScene(config,widgets=[]){
 const {w,h,ok}=dimensions(config),out=report('scene',w,h),items=Array.isArray(config?.items)?config.items:[],map=new Map((Array.isArray(widgets)?widgets:[]).filter(Boolean).map(widget=>[String(widget.id),widget]));
 out.stats.total=items.length;if(!ok){issue(out,'errors','Ungültiges Scene-Format. Bitte 1080 × 1920 oder 1920 × 1080 wählen.');return finish(out);}
 if(items.length===0)issue(out,'errors','Die Scene enthält noch keine Widgets.');
 for(let index=0;index<items.length;index++){
  const item=items[index]||{};if(item.visible===false||numeric(item.opacity,1)===0)continue;out.stats.visible++;
  const widget=map.get(String(item.widget_id)),name=String(widget?.name||`Element ${index+1}`).slice(0,64);
  if(!widget){issue(out,'errors',`${name}: Zugehöriges Widget nicht gefunden.`,item.id);continue;}
  if(widget.status!=='live')issue(out,'warnings',`${name}: Widget ist nicht veröffentlicht; die OBS-Quelle kann fehlen.`,item.id);
  const source=widget?.source_urls?.obs||widget?.source_url;if(!source)issue(out,'errors',`${name}: Keine OBS-Browserquelle vorhanden.`,item.id);
  const scale=numeric(item.scale,NaN),opacity=numeric(item.opacity,1),iw=numeric(widget.canvas?.width,NaN),ih=numeric(widget.canvas?.height,NaN),x=numeric(item.x,NaN),y=numeric(item.y,NaN);
  if(!Number.isFinite(scale)||scale<=0||!Number.isFinite(iw)||iw<=0||!Number.isFinite(ih)||ih<=0||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(opacity)||opacity<0||opacity>1){issue(out,'errors',`${name}: Position, Größe oder Deckkraft ist ungültig.`,item.id);continue;}
  const ratio=visibleRatio(sceneRenderBounds(x,y,iw,ih,scale,item.rotation),w,h);
  if(ratio===0)issue(out,'errors',`${name}: Liegt vollständig außerhalb der Scene.`,item.id,'recenter');
  else if(ratio<.85)issue(out,'warnings',`${name}: ${Math.round((1-ratio)*100)} % liegen außerhalb der Ausgabefläche.`,item.id,null,'scene-clipped');
  if(scale>1.5)issue(out,'warnings',`${name}: Vergrößerung ${scale.toFixed(2)}× kann die Darstellung unscharf machen.`,item.id,null,'scene-upscale');
 }
 if(out.stats.visible===0&&items.length)issue(out,'errors','Alle Widgets sind ausgeblendet oder vollständig transparent.');
 if(isTransparent(config?.canvas?.background))issue(out,'notes','Scene-Hintergrund ist transparent. OBS zeigt darunterliegende Quellen.');
 issue(out,'notes','Prüft Daten, Positionen und Quellen – keine Pixelqualität fremder Browser-Widgets.');
 return finish(out);
}
function analyzeWidget(config){
 const {w,h,ok}=dimensions(config),out=report('widget',w,h),elements=Array.isArray(config?.elements)?config.elements:[];
 out.stats.total=elements.length;if(!ok){issue(out,'errors','Ungültige Widget-Abmessungen (64 bis 3840 Pixel).');return finish(out);}
 if(!elements.length)issue(out,'errors','Das Widget enthält keine Elemente.');
 for(let index=0;index<elements.length;index++){
  const item=elements[index]||{},name=String(item.name||`${item.type||'Element'} ${index+1}`).slice(0,64);
  if(item.visible===false||item.hidden===true||numeric(item.opacity,1)===0)continue;
  out.stats.visible++;
  const x=numeric(item.position?.x,NaN),y=numeric(item.position?.y,NaN),width=numeric(item.size?.width,NaN),height=numeric(item.size?.height,NaN);
  if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0){issue(out,'errors',`${name}: Ungültige Position oder Abmessungen.`,item.id);continue;}
  const ratio=visibleRatio(bounds(x,y,width,height,item.rotation),w,h);
  if(ratio===0)issue(out,'errors',`${name}: Ist außerhalb des Widget-Canvas.`,item.id);
  else if(ratio<.85)issue(out,'warnings',`${name}: ${Math.round((1-ratio)*100)} % liegen außerhalb des Canvas.`,item.id,null,'widget-clipped');
  const src=String(item.data?.src||'').trim();
  if(item.type==='image'&&src.startsWith('http:'))issue(out,'warnings',`${name}: Unsichere HTTP-Bildquelle kann in OBS blockiert werden.`,item.id);
  if((item.type==='image'||item.type==='video')&&src.startsWith('data:')&&src.length>500000)issue(out,'warnings',`${name}: Eingebettete Medien sind sehr groß – besser die Dateibibliothek verwenden.`,item.id);
 }
 if(out.stats.visible===0&&elements.length)issue(out,'errors','Alle Elemente sind ausgeblendet oder vollständig transparent.');
 if(isTransparent(config?.canvas?.background))issue(out,'notes','Transparenter Canvas – für OBS-Overlays geeignet.');
 issue(out,'notes','Prüft Layout und Quellen – keine gerenderten Pixel, Dateikodierung oder Live-Daten.');
 return finish(out);
}
function progress(previous,current){
 if(!previous||!current||previous.kind!==current.kind)return null;
 const errors=previous.errors.length-current.errors.length;
 const warnings=previous.warnings.length-current.warnings.length;
 const parts=[];
 if(errors)parts.push(`${Math.abs(errors)} Fehler ${errors>0?'weniger':'mehr'}`);
 if(warnings)parts.push(`${Math.abs(warnings)} Hinweise ${warnings>0?'weniger':'mehr'}`);
 return parts.length?parts.join(' · '):null;
}
/* R44: compare issue identities, not only totals. Updated percentages keep one stable issue.
   This is in-memory only and never inspects/persists URLs, credentials or live frames. */
function changes(previous,current){
 if(!previous||!current||previous.kind!==current.kind)return {resolved:[],introduced:[],remaining:[]};
 const relevant=report=>report.findings.filter(f=>f.severity==='errors'||f.severity==='warnings');
 const key=f=>JSON.stringify([f.severity,f.elementId,f.code||f.text]);
 const before=new Map(relevant(previous).map(f=>[key(f),f]));
 const after=new Map(relevant(current).map(f=>[key(f),f]));
 return {resolved:[...before].filter(([k])=>!after.has(k)).map(([,f])=>f),introduced:[...after].filter(([k])=>!before.has(k)).map(([,f])=>f),remaining:[...after].filter(([k])=>before.has(k)).map(([,f])=>f)};
}
function populate(node,result,options={}){
 if(!node)return;node.replaceChildren();node.dataset.status=result.status;
 const doc=node.ownerDocument,lead=doc.createElement('strong');lead.textContent=`${result.dimensions} · ${result.summary}`;node.appendChild(lead);
 const change=progress(options.baseline,result);
 if(change){const progressLine=doc.createElement('small');progressLine.className='cfs-r43-progress';progressLine.textContent=`Seit erster Prüfung: ${change}.`;node.appendChild(progressLine);}
 const delta=changes(options.baseline,result);
 if(delta.resolved.length||delta.introduced.length){
  const details=doc.createElement('div');details.className='cfs-r44-changes';
  const heading=doc.createElement('strong');heading.textContent=`Einzelprobleme: ${delta.resolved.length} behoben · ${delta.introduced.length} neu · ${delta.remaining.length} weiterhin offen`;
  details.appendChild(heading);
  for(const [title,entries,kind] of [['Behoben',delta.resolved,'resolved'],['Neu',delta.introduced,'introduced']]){
   for(const finding of entries.slice(0,3)){
    const p=doc.createElement('p');p.className='cfs-r44-'+kind;p.textContent=`${title}: ${finding.text}`;details.appendChild(p);
   }
   if(entries.length>3){const summary=doc.createElement('small');summary.textContent=`Weitere ${entries.length-3} ${kind==='resolved'?'behobene':'neue'} Probleme`;details.appendChild(summary);}
  }
  if(typeof options.onResetBaseline==='function'){
   const reset=doc.createElement('button');reset.type='button';reset.className='cfs-r42-action cfs-r44-reset';reset.textContent='Neuen Vergleich starten';reset.addEventListener('click',options.onResetBaseline);details.appendChild(reset);
  }
  node.appendChild(details);
 }
 const labels={errors:'Problem',warnings:'Hinweis',notes:'Info'};
 for(const finding of result.findings||[]){
  const p=doc.createElement('p');p.className=`cfs-r41-${finding.severity}`;
  p.textContent=`${labels[finding.severity]||'Info'}: ${finding.text}`;
  if(finding.elementId!==null&&typeof options.onSelect==='function'){
   const btn=doc.createElement('button');btn.type='button';btn.className='cfs-r42-action';btn.textContent='Element auswählen';
   btn.addEventListener('click',()=>options.onSelect(finding.elementId));p.appendChild(btn);
  }
  if(finding.action==='recenter'&&typeof options.onFix==='function'){
   const btn=doc.createElement('button');btn.type='button';btn.className='cfs-r42-action';btn.textContent='Ins Bild setzen';
   if(typeof options.canFix==='function'&&!options.canFix(finding.elementId)){btn.disabled=true;btn.title='Position ist gesperrt oder Element fehlt.';}
   else btn.addEventListener('click',()=>options.onFix(finding.elementId));
   p.appendChild(btn);
  }
  node.appendChild(p);
 }
}
return {analyzeScene,analyzeWidget,populate,progress,changes,visibleRatio,bounds,sceneRenderBounds};
});
