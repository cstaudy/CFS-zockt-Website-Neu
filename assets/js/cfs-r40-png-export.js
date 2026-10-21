/* R40 · lossless, full-resolution element snapshots using the production Stream Maker renderer. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CFSR40PngExport=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const dynamicKinds=new Set(['timer','stopwatch','counter','goal','alert']);
function title(text){return String(text||'stream-element').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,56)||'stream-element';}
function filename(config,element){return `${title(config.name)}-${title(element.template)}-${element.width}x${element.height}.png`;}
function sourceReady(model,config,image,imageKey){const source=model.source(config);if(!source)return true;return Boolean(image&&image.complete!==false&&image.naturalWidth!==0&&image.width>0&&image.height>0&&source===imageKey);}
function alphaSummary(canvas,element,camera){const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('Die PNG-Transparenz konnte nicht geprüft werden.');const w=canvas.width,h=canvas.height,side=40,rgba=ctx.getImageData(0,0,w,h).data;let clear=0,opaque=0,partial=0;const sample=(x,y)=>{const offset=(Math.min(h-1,Math.max(0,y))*w+Math.min(w-1,Math.max(0,x)))*4+3;const a=rgba[offset];if(a===0)clear++;else if(a===255)opaque++;else partial++;return a;};for(let gy=0;gy<side;gy++)for(let gx=0;gx<side;gx++)sample(Math.floor((gx+.5)*w/side),Math.floor((gy+.5)*h/side));let centerAlpha=null;
 if(camera){const cut=element.cutout||{x:3,y:4,w:94,h:87};centerAlpha=sample(Math.floor(w*(Number(cut.x)+Number(cut.w)/2)/100),Math.floor(h*(Number(cut.y)+Number(cut.h)/2)/100));}
 return{transparentPercent:Math.round(clear/(side*side)*100),hasTransparency:clear>0||partial>0,centerAlpha,fullyOpaqueSamples:opaque,sampled:side*side};}
function capture(model,config,element,image,{imageKey='',now=Date.now(),documentRef=(typeof document!=='undefined'?document:null)}={}){
 if(!model||typeof model.render!=='function'||typeof model.source!=='function')throw new Error('Der Stream-Maker-Renderer ist nicht verfügbar.');
 if(!documentRef||typeof documentRef.createElement!=='function')throw new Error('Der PNG-Export benötigt einen Browser mit Canvas.');
 if(!element||!Number.isInteger(element.width)||!Number.isInteger(element.height)||element.width<160||element.height<120||element.width>3840||element.height>2160)throw new Error('Ungültige Ausgabemaße. Bitte Größe des Elements prüfen.');
 if(!sourceReady(model,config,image,imageKey))throw new Error('Das Designbild ist noch nicht vollständig geladen. Bitte auf die Vorschau warten und erneut exportieren.');
 const canvas=documentRef.createElement('canvas');canvas.width=element.width;canvas.height=element.height;
 const configSnapshot=JSON.parse(JSON.stringify(config));const elementSnapshot=JSON.parse(JSON.stringify(element));
 model.render(canvas,configSnapshot,elementSnapshot,image||null,{now,output:false});
 const def=model.catalog.find(item=>item.id===element.template);const camera=def?.kind==='camera';const qa=alphaSummary(canvas,elementSnapshot,camera);
 const notes=[];
 if(dynamicKinds.has(def?.kind))notes.push('Momentaufnahme: Live-Werte und Animationen laufen nur in der OBS-/HTML-Quelle weiter.');
 if(camera&&qa.centerAlpha!==0)notes.push('Achtung: Die Ausschnittmitte enthält sichtbare Pixel. Bitte Textposition und Kamerafeld prüfen.');
 if(camera&&!qa.hasTransparency)notes.push('Achtung: Dieser Kamerarahmen ist nicht transparent.');
 const source=model.source(configSnapshot);if(source&&image.width<element.width*.65&&image.height<element.height*.65)notes.push('Die Bildvorlage ist deutlich kleiner als die Ausgabe; eine höhere Auflösung kann schärfer wirken.');
 return{canvas,width:canvas.width,height:canvas.height,filename:filename(configSnapshot,elementSnapshot),qa,notes};
}
function pngBlob(canvas){return new Promise((resolve,reject)=>{if(typeof canvas.toBlob!=='function')return reject(new Error('Der Browser unterstützt keinen verlustfreien PNG-Export.'));try{canvas.toBlob(blob=>blob&&blob.size>0&&blob.type==='image/png'?resolve(blob):reject(new Error('PNG konnte nicht erzeugt werden.')),'image/png');}catch(error){reject(error);}});}
function download(blob,name,{documentRef=document,urlRef=URL}={}){if(!blob||blob.type!=='image/png')throw new Error('Keine gültige PNG-Datei.');const url=urlRef.createObjectURL(blob),a=documentRef.createElement('a');a.href=url;a.download=name;documentRef.body.append(a);try{a.click();}finally{a.remove();setTimeout(()=>urlRef.revokeObjectURL(url),30000);}}
return{capture,pngBlob,download,sourceReady,filename,alphaSummary};
});
