/* R47 · browser-based image source and real alpha preflight. Read-only; never uploads or edits assets. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CFSR47MediaAudit=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const MAX_IMAGES=60, MAX_WORKERS=3;
const finite=n=>Number.isFinite(Number(n))?Number(n):0;
const between=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
function images(config){return (Array.isArray(config?.elements)?config.elements:[]).filter(e=>e?.type==='image'&&e.visible!==false&&e.hidden!==true&&finite(e.opacity??1)>0).slice(0,MAX_IMAGES);}
function allowedSource(src){return /^\/widget-assets\/[a-z0-9._~-]+(?:\?[a-z0-9=&._~-]*)?$/i.test(src)||/^https:\/\/[^\s<>]+$/i.test(src)||/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(src);}
function remoteSource(src,origin){try{return /^https:\/\//i.test(src)&&new URL(src,origin||'https://localhost/').origin!==new URL(origin||'https://localhost/').origin;}catch{return false;}}
function findings(){return {kind:'media',status:'ok',imagesChecked:0,skippedLive:0,errors:[],warnings:[],notes:[],findings:[]};}
function issue(out,severity,code,text,id){const item={severity,code,text,elementId:id==null?null:String(id)};out.findings.push(item);out[severity].push(text);}
function label(e,i){return String(e.name||`Bild ${i+1}`).replace(/[\r\n<>]/g,' ').slice(0,60);}
function compareFrameAlpha(info){return info?.alphaKnown===true&&info.centerAlpha<=8;}
function checkImage(out,e,index,info,opts={}){
 const id=e.id,name=label(e,index),sw=finite(info.width),sh=finite(info.height),w=finite(e.size?.width),h=finite(e.size?.height);
 if(!(sw>0&&sh>0)){issue(out,'errors','image-size',`${name}: Bilddatei hat keine gültigen Pixelabmessungen.`,id);return;}
 out.imagesChecked++;
 const fit=String(e.style?.objectFit||'cover');const scale=fit==='contain'?Math.min(w/sw,h/sh):Math.max(w/sw,h/sh);
 if(w>0&&h>0&&scale>1.5)issue(out,'warnings','image-upscale',`${name}: Wird ${scale.toFixed(1)}× vergrößert (${sw} × ${sh} Quelle). Das kann unscharf werden.`,id);
 if(fit==='fill'&&w>0&&h>0){const distortion=Math.max((w/h)/(sw/sh),(sw/sh)/(w/h));if(distortion>1.10)issue(out,'warnings','image-distorted',`${name}: Bild wird durch „Strecken“ verzerrt (${sw} × ${sh} zu ${Math.round(w)} × ${Math.round(h)}).`,id);}
 const expectsHole=/(?:rahmen|frame|webcam.border|kamera.?rand)/i.test(name)||opts.expectFrame===true;
 if(expectsHole&&info.alphaKnown===true&&!compareFrameAlpha(info))issue(out,'warnings','frame-no-transparent-center',`${name}: Die Rahmenmitte ist nicht transparent. Das Bild könnte die Kamera verdecken.`,id);
 if(expectsHole&&info.alphaKnown!==true)issue(out,'notes','frame-alpha-unverified',`${name}: Transparenz der Rahmenmitte konnte nicht pixelgenau geprüft werden.`,id);
 if(info.transparentPct!=null&&info.alphaKnown===true)issue(out,'notes','image-alpha',`${name}: ${between(Math.round(info.transparentPct),0,100)} % der Stichprobe sind vollständig transparent.`,id);
}
function renderStatus(out){out.status=out.errors.length?'error':out.warnings.length?'warning':'ok';out.summary=`${out.imagesChecked} Bild${out.imagesChecked===1?'':'er'} geprüft · ${out.errors.length} Fehler · ${out.warnings.length} Hinweise`;return out;}
async function audit(config,{load=probeImage,origin=typeof location==='object'?location.href:'https://localhost/',timeoutMs=7000}={}){
 const out=findings(),items=images(config);if(items.length===0){issue(out,'notes','no-images','Keine sichtbaren Bilddateien vorhanden. Dynamische Widget-Elemente werden separat geprüft.');return renderStatus(out);}
 let position=0;async function worker(){while(position<items.length){const index=position++,e=items[index],id=e.id,name=label(e,index),src=String(e.data?.src||'').trim();
  if(e.data?.binding){out.skippedLive++;issue(out,'notes','live-binding',`${name}: Plattformbild wird erst mit echten Live-Daten geladen.`,id);continue;}
  if(!src){issue(out,'errors','image-missing',`${name}: Keine Bilddatei ausgewählt.`,id);continue;}
  if(!allowedSource(src)){issue(out,'errors','image-invalid-source',`${name}: Bildadresse ist nicht unterstützt oder unsicher.`,id);continue;}
  const external=remoteSource(src,origin);
  try{const info=await load(src,{timeoutMs,origin});checkImage(out,e,index,info);}
  catch(error){const type=String(error?.code||'load-error');issue(out,external?'warnings':'errors',external?'image-cross-origin':'image-unavailable',external?`${name}: Externe Bildquelle konnte nicht verlässlich geprüft werden (Netzwerk/CORS). OBS-Darstellung separat kontrollieren.`:`${name}: Bilddatei konnte nicht geladen oder dekodiert werden.`,id);}
 }}
 await Promise.all(Array.from({length:Math.min(MAX_WORKERS,items.length)},worker));
 // Deterministic output even when images finish in a different order.
 const order=new Map(items.map((e,i)=>[String(e.id),i]));out.findings.sort((a,b)=>(order.get(String(a.elementId))??999)-(order.get(String(b.elementId))??999));
 for(const severity of ['errors','warnings','notes'])out[severity]=out.findings.filter(f=>f.severity===severity).map(f=>f.text);
 if(Array.isArray(config?.elements)&&config.elements.filter(e=>e?.type==='image').length>MAX_IMAGES)issue(out,'notes','image-limit',`Maximal ${MAX_IMAGES} Bildquellen werden pro Prüfung verarbeitet.`);
 return renderStatus(out);
}
function probeImage(src,{timeoutMs=7000,origin=typeof location==='object'?location.href:'https://localhost/'}={}){
 return new Promise((resolve,reject)=>{
  if(typeof Image!=='function'||typeof document==='undefined'){reject(Object.assign(new Error('browser unavailable'),{code:'browser'}));return;}
  const img=new Image();let done=false;const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);img.onload=img.onerror=null;if(error){img.src='';reject(error);}else resolve(value);};
  const timer=setTimeout(()=>finish(Object.assign(new Error('timeout'),{code:'timeout'})),between(finite(timeoutMs)||7000,1000,15000));
  img.onload=()=>{const width=img.naturalWidth,height=img.naturalHeight;if(!width||!height){finish(new Error('invalid dimensions'));return;}
   const result={width,height,alphaKnown:false,transparentPct:null,centerAlpha:null};
   try{const canvas=document.createElement('canvas');const d=Math.min(96,Math.max(1,Math.round(width/Math.max(width,height)*96))),h=Math.min(96,Math.max(1,Math.round(height/Math.max(width,height)*96)));canvas.width=d;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(ctx){ctx.clearRect(0,0,d,h);ctx.drawImage(img,0,0,d,h);const data=ctx.getImageData(0,0,d,h).data;let transparent=0;for(let i=3;i<data.length;i+=4)if(data[i]<=8)transparent++;result.transparentPct=Math.round(transparent/(d*h)*100);result.centerAlpha=data[4*(Math.floor(h/2)*d+Math.floor(d/2))+3];result.alphaKnown=true;}}
   catch{/* A cross-origin canvas may be tainted; dimensions are still valid. */}
   finish(null,result);
  };
  img.onerror=()=>finish(Object.assign(new Error('decode failed'),{code:'decode'}));
  if(remoteSource(src,origin))img.crossOrigin='anonymous';
  img.src=src;
 });
}
function populate(node,report,{onSelect}={}){
 if(!node||!report)return;node.replaceChildren();node.hidden=false;node.dataset.status=report.status;
 const doc=node.ownerDocument,head=doc.createElement('strong');head.textContent=report.summary;node.appendChild(head);
 const note=doc.createElement('small');note.textContent='Echte Bildabmessungen und Pixelstichprobe · keine Live-/OBS-Prüfung. Originaldateien bleiben unverändert.';node.appendChild(note);
 for(const finding of report.findings.filter(f=>f.severity!=='notes').slice(0,16)){
  const row=doc.createElement('div');row.className='cfs-r47-media-issue';row.dataset.severity=finding.severity;
  const text=doc.createElement('span');text.textContent=finding.text;row.appendChild(text);
  if(finding.elementId&&typeof onSelect==='function'){const btn=doc.createElement('button');btn.type='button';btn.textContent='AUSWÄHLEN';btn.addEventListener('click',()=>onSelect(finding.elementId));row.appendChild(btn);}
  node.appendChild(row);
 }
 const omissions=report.findings.filter(f=>f.severity!=='notes').length-16;if(omissions>0){const remaining=doc.createElement('small');remaining.textContent=`Weitere ${omissions} Hinweise sind vorhanden.`;node.appendChild(remaining);}
 if(report.skippedLive){const dynamic=doc.createElement('small');dynamic.textContent=`${report.skippedLive} dynamische Bildquelle(n) benötigen einen separaten Live-Test.`;node.appendChild(dynamic);}
}
return {allowedSource,compareFrameAlpha,checkImage,audit,populate,probeImage};
});
